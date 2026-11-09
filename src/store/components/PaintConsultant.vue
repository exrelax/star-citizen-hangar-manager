<script setup lang="ts">
import { RSI_CART_PATH } from '@/buyback/cart';
import { useDemoContext } from '@/demo/use-demo';
import BulkExchangeOverlay from '@/hangar/components/BulkExchangeOverlay.vue';
import { formatPercent, formatUsd } from '@/hangar/discount-format';
import type { PledgeView } from '@/hangar/pledge-view';
import { openTabAt } from '@/hangar/open-tab-at';
import { BULK_MELTING_SETTING_ID } from '@/settings/anchors';
import { useStored } from '@/storage/use-stored';
import SvgIcon from '@/icons/SvgIcon.vue';
import { i18n, locale } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useSettings } from '@/settings/use-settings';
import { computed, ref } from 'vue';
import { refreshStoreItems } from '../items/sync-store-items';
import { usePaintConsultant } from '../paint-consultant/use-paint-consultant';
import {
  addLinesToCart,
  cartLinesOf,
  readCart,
  type CartLine,
  type CartResult,
} from '../paint-consultant/cart';
import {
  REBUY_PLAN_VERSION,
  rebuyPlanItem,
  storedPlanOf,
} from '../paint-consultant/rebuy-plan-storage';

/*
 * The Paint Discount Consultant (#95) in the Pledge Store tab: which own paints to melt and buy
 * again together with cheap filler paints at a higher volume discount, what the cart costs and
 * how much store credit it frees (see `paint-consultant/calculation.ts`). It explains every step
 * with the real values and says honestly that melt value turns into store credit.
 */

const props = defineProps<{ settings: Settings }>();

/** RSI's article on the 24-hour cooldown before a pledge can be melted. */
const COOLDOWN_SOURCE =
  'https://support.robertsspaceindustries.com/hc/en-us/articles/115013193627-Reclaim-a-Pledge';

// Worked out once for the manager (App.vue), also for the marks in My Hangar.
const { pledges, storeItems, creditUnknown, result } = usePaintConsultant();

const options = computed(() => props.settings.paintConsultant);
const { update } = useSettings();
/** The option is also in the settings (`PaintConsultantSection.vue`); both change the same value. */
const setSkipGiftable = (skipGiftable: boolean) =>
  update({ paintConsultant: { ...options.value, skipGiftable } });

const plan = computed(() => result.value?.plan);

const reading = ref(false);
async function readItems() {
  reading.value = true;
  try {
    await refreshStoreItems();
  } finally {
    reading.value = false;
  }
}

const usd = (value: number) => formatUsd(value, locale.value);
const percent = (value: number) => formatPercent(value, locale.value);
/** The factor the volume discount leaves, e.g. 0.65 for 35 %. */
const factor = (tierPercent: number) =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(
    (100 - tierPercent) / 100,
  );
/** What a paint costs in the cart at the plan's tier. */
const inCart = (price: number) =>
  plan.value ? Math.round(price * (100 - plan.value.tier.percent)) / 100 : price;

const ownTotal = computed(
  () => plan.value?.own.reduce((sum, paint) => sum + paint.storePaint.price, 0) ?? 0,
);
const fillerTotal = computed(
  () => plan.value?.fillers.reduce((sum, f) => sum + f.paint.price * f.quantity, 0) ?? 0,
);
/** What the filler paints melt for after 24 hours: what they cost in the cart. */
const fillerMelt = computed(() => (plan.value ? inCart(fillerTotal.value) : 0));
const meltAfter = computed(() =>
  plan.value ? Math.round((plan.value.meltValue - plan.value.storeCreditFreed) * 100) / 100 : 0,
);
const freedShare = computed(() =>
  plan.value && plan.value.meltValue > 0
    ? (plan.value.storeCreditFreed / plan.value.meltValue) * 100
    : 0,
);
const fillerCount = computed(
  () => plan.value?.fillers.reduce((sum, f) => sum + f.quantity, 0) ?? 0,
);

// ---- Into the cart (#103) ----

// The demo is for screenshots: nothing goes into the real cart.
const demo = useDemoContext();
/** `busy` while reading or filling the cart; `occupied` when the cart already holds items. */
const cartState = ref<'idle' | 'busy' | 'occupied' | 'done'>('idle');
/** The cart's items before adding, while it isn't empty. */
const cartBefore = ref<CartLine[]>([]);
const cartItemsBefore = computed(() => cartBefore.value.reduce((sum, line) => sum + line.qty, 0));
const cartResult = ref<CartResult>();
const cartError = ref<string>();

function openCart() {
  if (!window.open(RSI_CART_PATH, '_blank')) location.assign(RSI_CART_PATH);
}

/** Reads the cart first: other items in it change the volume discount tier. */
async function toCart() {
  if (!plan.value || demo.value || cartState.value === 'busy') return;
  cartState.value = 'busy';
  cartError.value = undefined;
  cartResult.value = undefined;
  try {
    cartBefore.value = await readCart();
    if (cartBefore.value.length) {
      cartState.value = 'occupied';
      return;
    }
    await fillCart();
  } catch (error) {
    reportCartError(error);
  }
}

/** Adds the plan's paints, keeps the plan for later (#105) and opens the cart. */
async function fillCart() {
  const current = plan.value;
  if (!current) return;
  cartState.value = 'busy';
  try {
    const result = await addLinesToCart(cartLinesOf(current));
    cartResult.value = result;
    if (result.added.length) await rebuyPlanItem.setValue(storedPlanOf(current, Date.now()));
    cartState.value = 'done';
    // With a refused paint the cart isn't what the plan needs: the user reads why first.
    if (!result.failed.length) openCart();
  } catch (error) {
    reportCartError(error);
  }
}

// ---- Melt the own paints at once (#104, with bulk melting on) ----

const storedPlan = useStored(rebuyPlanItem);
/** The own paints of the plan were put into the cart (#103): only then they may be melted. */
const cartFilled = computed(() => {
  const stored = storedPlan.value;
  if (!plan.value || stored?.version !== REBUY_PLAN_VERSION) return false;
  const inCart = new Set(stored.own.map((paint) => paint.pledgeId));
  return plan.value.own.every((paint) => inCart.has(paint.pledgeId));
});
/** The hangar's pledges of the plan's own paints. */
const ownPledges = computed(() => {
  const byId = new Map(pledges.value.map((pledge) => [pledge.id, pledge]));
  return (plan.value?.own ?? [])
    .map((paint) => byId.get(paint.pledgeId))
    .filter((pledge): pledge is PledgeView => !!pledge && pledge.isMeltable);
});
const melting = ref(false);
/** Bulk melting is off: the settings tab, at its setting. */
const openBulkMeltingSetting = () =>
  openTabAt('settings', BULK_MELTING_SETTING_ID, { highlight: true });

function reportCartError(error: unknown) {
  console.error('[star-citizen-hangar-manager] Filling the cart failed', error);
  cartError.value = error instanceof Error ? error.message : String(error);
  cartState.value = 'idle';
}
</script>

<template>
  <section class="shm-consultant" aria-labelledby="shm-consultant-title">
    <!-- Styled like the warbond title above (`shm-store-title`, modern.css). -->
    <h3 id="shm-consultant-title" class="shm-store-title shm-consultant-title">
      {{ i18n.t('consultant.title') }}
    </h3>
    <p class="shm-consultant-intro">{{ i18n.t('consultant.intro') }}</p>

    <p v-if="settings.hideMeltValue" class="shm-consultant-state">
      {{ i18n.t('consultant.hidden') }}
    </p>
    <div v-else-if="!storeItems" class="shm-consultant-state">
      <p>{{ i18n.t('consultant.noItems') }}</p>
      <button type="button" class="shm-button" :disabled="reading" @click="readItems">
        {{ i18n.t(reading ? 'consultant.reading' : 'consultant.readItems') }}
      </button>
    </div>
    <template v-else>
      <label class="shm-consultant-option">
        <input
          type="checkbox"
          :checked="options.skipGiftable"
          @change="setSkipGiftable(($event.target as HTMLInputElement).checked)"
        />
        <span>
          {{ i18n.t('consultant.skipGiftable') }}
          <span class="shm-consultant-option-hint">{{
            i18n.t('consultant.skipGiftableHint')
          }}</span>
        </span>
      </label>
      <p v-if="result?.giftableSkipped" class="shm-consultant-note is-info">
        {{ i18n.t('consultant.giftableSkipped', [result.giftableSkipped]) }}
      </p>
      <p v-if="creditUnknown" class="shm-consultant-note">{{ i18n.t('consultant.noCredit') }}</p>

      <p v-if="!plan && !result?.next" class="shm-consultant-state">
        {{ i18n.t('consultant.nothing') }}
      </p>
      <p v-else-if="!plan && result?.next" class="shm-consultant-state">
        {{
          i18n.t('consultant.notEnough', [
            usd(result.next.missing),
            percent(result.next.tier.percent),
            result.next.tier.paints,
          ])
        }}
      </p>

      <div v-if="plan" class="shm-consultant-plan">
        <dl class="shm-consultant-totals">
          <div>
            <dt>{{ i18n.t('consultant.tier') }}</dt>
            <dd>
              {{ i18n.t('consultant.tierValue', [percent(plan.tier.percent), plan.tier.paints]) }}
            </dd>
          </div>
          <div>
            <dt v-tooltip="i18n.t('consultant.freedHint')" class="has-hint">
              {{ i18n.t('consultant.freed') }}
            </dt>
            <dd class="is-gain">
              {{
                i18n.t('consultant.freedValue', [usd(plan.storeCreditFreed), percent(freedShare)])
              }}
            </dd>
          </div>
          <div>
            <dt v-tooltip="i18n.t('consultant.neededHint')" class="has-hint">
              {{ i18n.t('consultant.needed') }}
            </dt>
            <dd>{{ usd(plan.storeCreditNeeded) }}</dd>
          </div>
          <div v-if="result?.next">
            <dt>{{ i18n.t('consultant.next') }}</dt>
            <dd>
              {{
                i18n.t('consultant.nextValue', [
                  usd(result.next.missing),
                  percent(result.next.tier.percent),
                ])
              }}
            </dd>
          </div>
        </dl>

        <!-- The calculation with the real values. -->
        <ol class="shm-consultant-steps">
          <li>
            {{
              plan.fillers.length
                ? i18n.t('consultant.cart', [
                    usd(ownTotal),
                    usd(fillerTotal),
                    factor(plan.tier.percent),
                    usd(plan.cartCost),
                  ])
                : i18n.t('consultant.cartOwnOnly', [
                    usd(ownTotal),
                    factor(plan.tier.percent),
                    usd(plan.cartCost),
                  ])
            }}
          </li>
          <li>
            {{ i18n.t('consultant.payment', [usd(plan.meltValue), usd(plan.storeCreditNeeded)]) }}
          </li>
          <li>
            {{
              plan.fillers.length
                ? i18n.t('consultant.result', [
                    usd(fillerMelt),
                    usd(plan.storeCreditFreed),
                    usd(plan.meltValue),
                    usd(meltAfter),
                  ])
                : i18n.t('consultant.resultOwnOnly', [
                    usd(plan.storeCreditFreed),
                    usd(plan.meltValue),
                    usd(meltAfter),
                  ])
            }}
          </li>
        </ol>

        <h4 class="shm-consultant-subtitle">
          {{ i18n.t('consultant.ownTitle', [plan.own.length]) }}
        </h4>
        <div class="shm-consultant-table-wrap">
          <table class="shm-consultant-table">
            <thead>
              <tr>
                <th scope="col">{{ i18n.t('consultant.colPaint') }}</th>
                <th scope="col" class="is-number">{{ i18n.t('consultant.colPrice') }}</th>
                <th
                  v-tooltip="i18n.t('consultant.meltHint')"
                  scope="col"
                  class="is-number has-hint"
                >
                  {{ i18n.t('consultant.colMelt') }}
                </th>
                <th scope="col" class="is-number">{{ i18n.t('consultant.colCart') }}</th>
                <th scope="col" class="is-number">{{ i18n.t('consultant.colDiscount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="paint in plan.own" :key="paint.pledgeId">
                <th scope="row">
                  {{ paint.storePaint.name }}
                  <span
                    v-if="paint.giftable"
                    v-tooltip="i18n.t('consultant.giftableTagHint')"
                    class="shm-consultant-tag"
                  >
                    {{ i18n.t('consultant.giftableTag') }}
                  </span>
                </th>
                <td class="is-number">{{ usd(paint.storePaint.price) }}</td>
                <td class="is-number">{{ usd(paint.meltValue) }}</td>
                <td class="is-number">{{ usd(inCart(paint.storePaint.price)) }}</td>
                <td class="is-number">
                  {{
                    i18n.t('consultant.discountChange', [
                      percent(paint.discount),
                      percent(plan.tier.percent),
                    ])
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <template v-if="plan.fillers.length">
          <h4 class="shm-consultant-subtitle">
            {{ i18n.t('consultant.fillerTitle', [fillerCount]) }}
          </h4>
          <div class="shm-consultant-table-wrap">
            <table class="shm-consultant-table">
              <thead>
                <tr>
                  <th scope="col">{{ i18n.t('consultant.colPaint') }}</th>
                  <th scope="col" class="is-number">{{ i18n.t('consultant.colCount') }}</th>
                  <th scope="col" class="is-number">{{ i18n.t('consultant.colPrice') }}</th>
                  <th scope="col" class="is-number">{{ i18n.t('consultant.colCart') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="filler in plan.fillers" :key="filler.paint.id">
                  <th scope="row">{{ filler.paint.name }}</th>
                  <td class="is-number">{{ filler.quantity }}</td>
                  <td class="is-number">{{ usd(filler.paint.price) }}</td>
                  <td class="is-number">
                    {{ usd(inCart(filler.paint.price * filler.quantity)) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <h4 class="shm-consultant-subtitle">{{ i18n.t('consultant.beforeTitle') }}</h4>
        <ul class="shm-consultant-notes">
          <li>{{ i18n.t('consultant.stepOrder') }}</li>
          <li>{{ i18n.t('consultant.stepCredit') }}</li>
          <li>
            {{ i18n.t('consultant.stepCooldown') }}
            <a :href="COOLDOWN_SOURCE" target="_blank" rel="noopener noreferrer">
              {{ i18n.t('consultant.cooldownSource') }}
            </a>
          </li>
          <li>{{ i18n.t('consultant.stepPacks') }}</li>
        </ul>

        <!-- Fills RSI's cart; the user checks it and pays there – nothing is checked out here. -->
        <div class="shm-consultant-cart">
          <button
            v-tooltip="demo ? i18n.t('exchange.demo') : i18n.t('consultant.toCartHint')"
            type="button"
            class="shm-button"
            :class="{ 'is-busy': cartState === 'busy' }"
            :disabled="!!demo || cartState === 'busy' || cartState === 'occupied'"
            @click="toCart"
          >
            <SvgIcon name="basket-shopping" />
            {{ i18n.t('consultant.toCart', [plan.own.length + fillerCount]) }}
          </button>

          <div v-if="cartState === 'occupied'" class="shm-consultant-note" role="alert">
            <p>{{ i18n.t('consultant.cartOccupied', [cartItemsBefore]) }}</p>
            <div class="shm-consultant-cart-actions">
              <button type="button" class="shm-button" @click="openCart">
                <SvgIcon name="square-up-right" />
                {{ i18n.t('consultant.openCart') }}
              </button>
              <button type="button" class="shm-button" @click="fillCart">
                {{ i18n.t('consultant.addAnyway') }}
              </button>
              <button type="button" class="shm-button" @click="cartState = 'idle'">
                {{ i18n.t('consultant.cancel') }}
              </button>
            </div>
          </div>

          <div v-if="cartResult?.failed.length" class="shm-consultant-note" role="alert">
            <p>{{ i18n.t('consultant.cartFailed') }}</p>
            <ul>
              <li v-for="failure in cartResult.failed" :key="failure.line.skuId">
                {{ failure.line.name }} × {{ failure.line.qty }}: {{ failure.reason }}
              </li>
            </ul>
            <button type="button" class="shm-button" @click="openCart">
              <SvgIcon name="square-up-right" />
              {{ i18n.t('consultant.openCart') }}
            </button>
          </div>
          <p v-else-if="cartState === 'done'" class="shm-consultant-note is-info" role="status">
            {{ i18n.t('consultant.cartDone') }}
            <button type="button" class="shm-link-button" @click="openCart">
              {{ i18n.t('consultant.openCart') }}
            </button>
          </p>
          <p v-if="cartError" class="shm-consultant-note" role="alert">
            {{ i18n.t('consultant.cartError', [cartError]) }}
          </p>

          <!-- Bulk melting (experimental): the own paints at once, after the cart was filled. -->
          <template v-if="settings.bulkMelting && ownPledges.length">
            <button
              v-tooltip="
                demo
                  ? i18n.t('exchange.demo')
                  : cartFilled
                    ? i18n.t('consultant.meltHintReady')
                    : i18n.t('consultant.meltHintCart')
              "
              type="button"
              class="shm-button is-danger"
              :disabled="!!demo || !cartFilled"
              @click="melting = true"
            >
              <SvgIcon name="triangle-exclamation" />
              {{ i18n.t('consultant.meltOwn', [ownPledges.length]) }}
            </button>
            <BulkExchangeOverlay
              v-if="melting"
              :pledges="ownPledges"
              :hangar="pledges"
              :skipped="0"
              :extra-consent="i18n.t('consultant.meltConsent')"
              @close="melting = false"
            />
          </template>
          <!-- Off: points to the experimental setting, as the sidebar's "Selected" box does. -->
          <button
            v-else-if="ownPledges.length"
            v-tooltip="i18n.t('bulkExchange.disabledHint')"
            type="button"
            class="shm-button"
            @click="openBulkMeltingSetting"
          >
            <SvgIcon name="gear" />
            {{ i18n.t('bulkExchange.disabled') }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<style>
.shm-consultant {
  margin-top: 32px;
}

.shm-consultant-title {
  /* Below RSI's fixed top bar when scrolled to from My Hangar. */
  scroll-margin-top: 90px;
  margin: 0 0 4px;
  color: var(--shm-text-strong);
  font-size: calc(16px * var(--shm-font-scale));
  font-weight: normal;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-consultant-intro,
.shm-consultant-note {
  margin: 0;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-consultant-note {
  margin-top: 8px;
  color: var(--shm-warning);
}

.shm-consultant-note.is-info {
  color: var(--shm-text-muted);
}

/* The option to leave out giftable paints, right below the intro. */
.shm-consultant-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  color: var(--shm-text);
  font-size: calc(13px * var(--shm-font-scale));
  cursor: pointer;
}

.shm-consultant-option input {
  margin: 3px 0 0;
  accent-color: var(--shm-accent);
}

.shm-consultant-option-hint {
  display: block;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
}

/* Marks an own paint that would lose its gift status. */
.shm-consultant-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  color: var(--shm-warning);
  font-size: calc(11px * var(--shm-font-scale));
  border: 1px solid currentColor;
  border-radius: var(--shm-radius-tag);
}

.shm-consultant-state {
  margin: 20px 0;
  color: var(--shm-text-muted);
}

.shm-consultant-state p {
  margin: 0 0 8px;
}

.shm-consultant-plan {
  margin-top: 14px;
  padding: 14px 16px;
  background: rgb(var(--shm-surface-rgb) / 0.8);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
  border-radius: var(--shm-radius-cell);
}

.shm-consultant-totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px 20px;
  margin: 0;
}

.shm-consultant-totals dt {
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-consultant-totals dd {
  margin: 2px 0 0;
  color: var(--shm-text);
  font-size: calc(15px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-consultant-totals dd.is-gain {
  color: var(--shm-success);
}

/* Terms explained in a tooltip. */
.shm-consultant .has-hint {
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  cursor: help;
}

.shm-consultant-steps {
  margin: 14px 0 0;
  padding-left: 20px;
  color: var(--shm-text);
  font-size: calc(13px * var(--shm-font-scale));
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}

.shm-consultant-subtitle {
  margin: 18px 0 6px;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: 600;
}

/* Wide tables scroll in their box instead of widening the page. */
.shm-consultant-table-wrap {
  overflow-x: auto;
}

.shm-consultant-table {
  width: 100%;
  border-collapse: collapse;
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-consultant-table th,
.shm-consultant-table td {
  padding: 6px 8px;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.12);
}

.shm-consultant-table thead th {
  color: var(--shm-text-muted);
  font-weight: normal;
}

.shm-consultant-table tbody th {
  color: var(--shm-text);
  font-weight: normal;
  white-space: normal;
}

.shm-consultant-table .is-number {
  text-align: right;
}

.shm-consultant-notes {
  margin: 0;
  padding-left: 18px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  line-height: 1.5;
}

/*
 * RSI's own styles take the bullets and the indent off lists; its `#billing .content ul` wins
 * over classes, hence `!important`.
 */
.shm-consultant .shm-consultant-notes {
  padding-left: 18px !important;
}

.shm-consultant .shm-consultant-notes li {
  display: list-item;
  margin: 2px 0;
  list-style: disc outside;
}

.shm-consultant-notes a {
  color: var(--shm-accent);
}
.shm-consultant-cart {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-top: 18px;
}

.shm-consultant-cart .shm-consultant-note {
  margin: 0;
}

.shm-consultant-cart .shm-consultant-note p,
.shm-consultant-cart .shm-consultant-note ul {
  margin: 0 0 8px;
}

.shm-consultant-cart-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.shm-consultant-cart .shm-link-button {
  padding: 0;
  color: var(--shm-accent);
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-consultant-cart .shm-link-button:hover,
.shm-consultant-cart .shm-link-button:focus-visible {
  text-decoration: underline;
  outline: none;
}
</style>

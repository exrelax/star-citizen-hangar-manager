<script setup lang="ts">
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
import { cartLinesOf } from '../paint-consultant/cart';
import PaintCartButton from './PaintCartButton.vue';
import PaintConsultantWays from './PaintConsultantWays.vue';
import {
  REBUY_PLAN_VERSION,
  rebuyPlanItem,
  demoRebuyPlanItem,
  rebuyPlanItemOf,
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
const { pledges, storeItems, creditUnknown, storeCredit, result, pending } = usePaintConsultant();

const options = computed(() => props.settings.paintConsultant);
/** Both ways side by side as cards (the default), or the plan in tables. */
const ways = computed(() => options.value.layout === 'ways');
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

// The demo is for screenshots: nothing goes into the real cart, nothing is melted.
const demo = useDemoContext();
const planLines = computed(() => (plan.value ? cartLinesOf(plan.value) : []));
/** Keeps the plan once its paints are in the cart, for later (#105, #139, #168). */
async function keepPlan() {
  if (plan.value) await planItem().setValue(storedPlanOf(plan.value, Date.now()));
}

// ---- Melt the own paints at once (#104, with bulk melting on) ----

// The demo has a kept plan of its own (#131), never the account's.
const realPlan = useStored(rebuyPlanItem);
const demoPlan = useStored(demoRebuyPlanItem);
const storedPlan = computed(() => (demo.value ? demoPlan.value : realPlan.value));
const planItem = () => rebuyPlanItemOf(!!demo.value);
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
/**
 * Melted first (#168): the plan is kept, so the paints to buy again are known once they are gone
 * from the hangar. A plan kept with the cart (way 1) stays as it is.
 */
async function keepPlanMelted() {
  if (!cartFilled.value) await keepPlan();
}

// ---- Paints bought again already (#139): only melting the old pledges is left ----

const rebought = computed(() => result.value?.rebought ?? []);
/** Store credit melting the old pledges gives. */
const reboughtCredit = computed(
  () => Math.round(rebought.value.reduce((sum, { old }) => sum + old.meltValue, 0) * 100) / 100,
);
/** The newest purchase of the copies, for the done steps. */
const reboughtOn = computed(
  () =>
    rebought.value
      .map(({ copy }) => copy.boughtOn)
      .filter((on): on is string => !!on)
      .sort()
      .at(-1) ?? '',
);
const reboughtPledges = computed(() => {
  const byId = new Map(pledges.value.map((pledge) => [pledge.id, pledge]));
  return rebought.value
    .map(({ old }) => byId.get(old.pledgeId))
    .filter((pledge): pledge is PledgeView => !!pledge && pledge.isMeltable);
});
const meltingRebought = ref(false);
/** Pairs that look bought again without a kept plan (`reboughtDetection: 'guess'`). */
const probablyRebought = computed(() => result.value?.probablyRebought ?? []);
// ---- Melted first, left to buy (#168) ----

const pendingFillerCount = computed(
  () => pending.value?.plan?.fillers.reduce((sum, f) => sum + f.quantity, 0) ?? 0,
);
const pendingLines = computed(() =>
  pending.value?.plan
    ? cartLinesOf({ own: pending.value.toBuy, fillers: pending.value.plan.fillers })
    : [],
);
/** What a paint costs in the cart at the tier the store credit pays now. */
const inPendingCart = (price: number) =>
  pending.value?.plan ? Math.round(price * (100 - pending.value.plan.tier.percent)) / 100 : price;
/** The kept plan takes the tier and the filler paints really put into the cart (#105). */
async function keepPendingPlan() {
  const stored = storedPlan.value;
  const current = pending.value?.plan;
  if (!stored || !current) return;
  await planItem().setValue({
    ...stored,
    tier: { ...current.tier },
    fillers: current.fillers.map((filler) => ({
      skuId: filler.paint.id,
      name: filler.paint.name,
      quantity: filler.quantity,
      price: filler.paint.price,
    })),
    cartCost: current.cartCost,
  });
}

/** Bulk melting is off: the settings tab, at its setting. */
const openBulkMeltingSetting = () =>
  openTabAt('settings', BULK_MELTING_SETTING_ID, { highlight: true });
</script>

<template>
  <section
    class="shm-consultant"
    :class="{ 'is-ways': ways }"
    aria-labelledby="shm-consultant-title"
  >
    <div class="shm-consultant-head">
      <div>
        <!-- Styled like the warbond title above (`shm-store-title`, modern.css). -->
        <h3 id="shm-consultant-title" class="shm-store-title shm-consultant-title">
          {{ i18n.t('consultant.title') }}
        </h3>
        <p
          v-if="ways"
          v-tooltip="i18n.t('consultant.intro')"
          class="shm-consultant-intro has-hint-text"
        >
          {{ i18n.t('consultant.ways.intro') }}
        </p>
        <p v-else class="shm-consultant-intro">{{ i18n.t('consultant.intro') }}</p>
      </div>
      <!-- The cards: the option next to the title, its hint in a tooltip. -->
      <label
        v-if="ways && storeItems && !settings.hideMeltValue"
        v-tooltip="i18n.t('consultant.skipGiftableHint')"
        class="shm-consultant-option"
      >
        <input
          type="checkbox"
          :checked="options.skipGiftable"
          @change="setSkipGiftable(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ i18n.t('consultant.skipGiftable') }}</span>
      </label>
    </div>

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
      <label v-if="!ways" class="shm-consultant-option">
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

      <!-- Bought again already: steps 1 and 2 done, melting the old pledges is left. -->
      <div v-if="rebought.length" class="shm-consultant-plan shm-consultant-rebought">
        <h4 class="shm-consultant-subtitle">
          {{ i18n.t('consultant.reboughtTitle', [rebought.length]) }}
        </h4>
        <ol class="shm-consultant-steps shm-consultant-progress">
          <li class="is-done">
            <SvgIcon name="circle-check" />
            {{ i18n.t('consultant.reboughtCart') }}
          </li>
          <li class="is-done">
            <SvgIcon name="circle-check" />
            {{
              reboughtOn
                ? i18n.t('consultant.reboughtPaidOn', [reboughtOn])
                : i18n.t('consultant.reboughtPaid')
            }}
          </li>
          <li class="is-open">
            <SvgIcon name="recycle" />
            {{
              rebought.length === 1
                ? i18n.t('consultant.reboughtMeltOne', [usd(reboughtCredit)])
                : i18n.t('consultant.reboughtMelt', [rebought.length, usd(reboughtCredit)])
            }}
          </li>
        </ol>
        <div class="shm-consultant-table-wrap">
          <table class="shm-consultant-table">
            <thead>
              <tr>
                <th scope="col">{{ i18n.t('consultant.colPaint') }}</th>
                <th scope="col" class="is-number">{{ i18n.t('consultant.colOld') }}</th>
                <th scope="col" class="is-number">{{ i18n.t('consultant.colMelt') }}</th>
                <th scope="col" class="is-number">{{ i18n.t('consultant.colCopy') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="{ old, copy } in rebought" :key="old.pledgeId">
                <th scope="row">{{ old.storePaint.name }}</th>
                <td class="is-number">
                  {{ i18n.t('consultant.oldValue', [percent(old.discount)]) }}
                </td>
                <td class="is-number">{{ usd(old.meltValue) }}</td>
                <td class="is-number">
                  {{
                    copy.boughtOn
                      ? i18n.t('consultant.copyValueOn', [percent(copy.discount), copy.boughtOn])
                      : i18n.t('consultant.copyValue', [percent(copy.discount)])
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="shm-consultant-note is-info">{{ i18n.t('consultant.reboughtSafe') }}</p>
        <div v-if="reboughtPledges.length" class="shm-consultant-cart">
          <template v-if="settings.bulkMelting">
            <button
              v-tooltip="i18n.t('consultant.meltOldHint')"
              type="button"
              class="shm-button is-danger"
              @click="meltingRebought = true"
            >
              <SvgIcon name="triangle-exclamation" />
              {{
                reboughtPledges.length === 1
                  ? i18n.t('consultant.meltOldOne')
                  : i18n.t('consultant.meltOld', [reboughtPledges.length])
              }}
            </button>
            <BulkExchangeOverlay
              v-if="meltingRebought"
              :pledges="reboughtPledges"
              :hangar="pledges"
              :skipped="0"
              @close="meltingRebought = false"
            />
          </template>
          <button
            v-else
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

      <!-- Melted first (#168): the kept plan says what is left to buy again. -->
      <div v-if="pending" class="shm-consultant-plan shm-consultant-pending">
        <h4 class="shm-consultant-subtitle">
          {{ i18n.t('consultant.pendingTitle', [pending.toBuy.length]) }}
        </h4>
        <ol class="shm-consultant-steps shm-consultant-progress">
          <li class="is-done">
            <SvgIcon name="circle-check" />
            {{ i18n.t('consultant.pendingMelted') }}
          </li>
          <li class="is-open">
            <SvgIcon name="basket-shopping" />
            {{
              pending.plan
                ? i18n.t('consultant.pendingBuy', [
                    percent(pending.plan.tier.percent),
                    pending.toBuy.length + pendingFillerCount,
                    usd(pending.plan.cartCost),
                  ])
                : i18n.t('consultant.pendingNoTier')
            }}
          </li>
        </ol>
        <div v-if="pending.toBuy.length" class="shm-consultant-table-wrap">
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
              <tr v-for="paint in pending.toBuy" :key="paint.pledgeId">
                <th scope="row">{{ paint.storePaint.name }}</th>
                <td class="is-number">1</td>
                <td class="is-number">{{ usd(paint.storePaint.price) }}</td>
                <td class="is-number">{{ usd(inPendingCart(paint.storePaint.price)) }}</td>
              </tr>
              <tr
                v-for="filler in pending.plan?.fillers ?? []"
                :key="`filler-${filler.paint.id}`"
                class="is-filler"
              >
                <th scope="row">
                  {{ filler.paint.name }}
                  <span class="shm-consultant-tag">{{ i18n.t('consultant.fillerTag') }}</span>
                </th>
                <td class="is-number">{{ filler.quantity }}</td>
                <td class="is-number">{{ usd(filler.paint.price) }}</td>
                <td class="is-number">
                  {{ usd(inPendingCart(filler.paint.price * filler.quantity)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="pending.missing" class="shm-consultant-note">
          {{
            i18n.t('consultant.pendingMissing', [
              usd(pending.missing.missing),
              percent(pending.missing.tier.percent),
            ])
          }}
        </p>
        <p v-if="pending.unavailable.length" class="shm-consultant-note">
          {{ i18n.t('consultant.pendingUnavailable', [pending.unavailable.join(', ')]) }}
        </p>
        <div v-if="pendingLines.length" class="shm-consultant-cart">
          <PaintCartButton :lines="pendingLines" @filled="keepPendingPlan" />
        </div>
      </div>

      <!-- A guess without a kept plan: shown to check, nothing is done with it. -->
      <div v-if="probablyRebought.length" class="shm-consultant-note is-info" role="note">
        <p>
          {{
            probablyRebought.length === 1
              ? i18n.t('consultant.probablyReboughtOne')
              : i18n.t('consultant.probablyRebought', [probablyRebought.length])
          }}
        </p>
        <ul>
          <li v-for="{ old, copy } in probablyRebought" :key="old.pledgeId">
            {{
              i18n.t('consultant.probablyReboughtItem', [
                old.storePaint.name,
                percent(old.discount),
                percent(copy.discount),
                copy.boughtOn ?? '–',
              ])
            }}
          </li>
        </ul>
      </div>

      <p v-if="!plan && !result?.next && !rebought.length" class="shm-consultant-state">
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

      <PaintConsultantWays
        v-if="plan && ways"
        :plan="plan"
        :buy-first="result?.buyFirst"
        :credit="storeCredit"
        :next="result?.next"
        :settings="settings"
      />
      <div v-else-if="plan" class="shm-consultant-plan">
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
          <PaintCartButton :lines="planLines" @filled="keepPlan" />

          <!-- Bulk melting (experimental): the own paints at once, after the cart was filled. -->
          <template v-if="settings.bulkMelting && ownPledges.length">
            <button
              v-tooltip="
                cartFilled ? i18n.t('consultant.meltHintReady') : i18n.t('consultant.meltFirstHint')
              "
              type="button"
              class="shm-button is-danger"
              @click="melting = true"
            >
              <SvgIcon name="triangle-exclamation" />
              {{
                cartFilled
                  ? i18n.t('consultant.meltOwn', [ownPledges.length])
                  : i18n.t('consultant.meltFirst', [ownPledges.length])
              }}
            </button>
            <!-- Way 2 (#168): melting before buying needs its own acknowledgement. -->
            <BulkExchangeOverlay
              v-if="melting"
              :pledges="ownPledges"
              :hangar="pledges"
              :skipped="0"
              :extra-consent="
                cartFilled
                  ? i18n.t('consultant.meltConsent')
                  : i18n.t('consultant.meltFirstConsent')
              "
              @exchanged="keepPlanMelted"
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

/* The cards: the title and a short intro, the option next to them. */
.shm-consultant.is-ways .shm-consultant-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 16px;
}

.shm-consultant.is-ways .shm-consultant-head .shm-consultant-option {
  align-items: center;
  margin-top: 0;
}

.shm-consultant.is-ways .shm-consultant-head .shm-consultant-option input {
  margin: 0;
}

.shm-consultant-intro.has-hint-text {
  cursor: help;
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
/* The steps of paints bought again: done ones checked, the open one stands out. */
.shm-consultant-progress {
  padding-left: 0;
  list-style: none;
}

.shm-consultant-progress li {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.shm-consultant-progress li.is-done {
  color: var(--shm-text-muted);
}

.shm-consultant-progress li.is-done .shm-icon {
  color: var(--shm-success);
}

.shm-consultant-progress li.is-open {
  font-weight: 600;
}

.shm-consultant-progress li.is-open .shm-icon {
  color: var(--shm-accent);
}

.shm-consultant-rebought + .shm-consultant-plan {
  margin-top: 18px;
}
</style>

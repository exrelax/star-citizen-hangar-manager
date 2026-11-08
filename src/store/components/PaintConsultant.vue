<script setup lang="ts">
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { useDemoContext } from '@/demo/use-demo';
import { formatPercent, formatUsd } from '@/hangar/discount-format';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n, locale } from '@/i18n';
import type { Settings } from '@/settings/settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useStored } from '@/storage/use-stored';
import { computed, ref } from 'vue';
import { storeItemsItem, STORE_ITEMS_VERSION } from '../items/store-items-storage';
import { refreshStoreItems } from '../items/sync-store-items';
import { planPaintRebuy } from '../paint-consultant/calculation';

/*
 * The Paint Discount Consultant (#95) in the Pledge Store tab: which own paints to melt and buy
 * again together with cheap filler paints at a higher volume discount, what the cart costs and
 * how much store credit it frees (see `paint-consultant/calculation.ts`). It explains every step
 * with the real values and says honestly that melt value turns into store credit.
 */

const props = defineProps<{
  /** The hangar's pledges (in the demo mode the demo selection). */
  pledges: readonly PledgeView[];
  settings: Settings;
}>();

/** RSI's article on the 24-hour cooldown before a pledge can be melted. */
const COOLDOWN_SOURCE =
  'https://support.robertsspaceindustries.com/hc/en-us/articles/115013193627-Reclaim-a-Pledge';

const storedItems = useStored(storeItemsItem);
const storeItems = computed(() =>
  storedItems.value?.version === STORE_ITEMS_VERSION ? storedItems.value.items : undefined,
);

// The account's store credit (in the demo mode a made-up one), in USD only.
const storedCredit = useStored(storeCreditItem);
const demo = useDemoContext();
const credit = computed(() => {
  const stored = storedCredit.value;
  const value =
    demo.value?.storeCredit ??
    (stored?.version === STORE_CREDIT_VERSION ? stored.credit : undefined);
  return value?.currency === 'USD' ? value.amount : undefined;
});

const options = computed(() => props.settings.paintConsultant);
/** The store credit is to be used, but isn't known (yet): it counts as $0. */
const creditUnknown = computed(() => options.value.useStoreCredit && credit.value === undefined);

const result = computed(() =>
  storeItems.value
    ? planPaintRebuy({
        pledges: props.pledges,
        storeItems: storeItems.value,
        storeCredit: options.value.useStoreCredit ? (credit.value ?? 0) : 0,
        useFillers: options.value.useFillers,
      })
    : undefined,
);
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
</script>

<template>
  <section class="shm-consultant" aria-labelledby="shm-consultant-title">
    <h3 id="shm-consultant-title" class="shm-consultant-title">
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
                <th scope="row">{{ paint.storePaint.name }}</th>
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
      </div>
    </template>
  </section>
</template>

<style>
.shm-consultant {
  margin-top: 32px;
}

.shm-consultant-title {
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
</style>

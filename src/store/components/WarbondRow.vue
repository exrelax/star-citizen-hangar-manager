<script setup lang="ts">
import { formatDiscount, formatPercent, formatUsd } from '@/hangar/discount-format';
import SvgIcon from '@/icons/SvgIcon.vue';
import { i18n, locale } from '@/i18n';
import { computed, ref } from 'vue';
import { ownedCounts, type WarbondOffer } from '../warbond';

const props = defineProps<{ offer: WarbondOffer }>();

const expanded = ref(false);

/** Clicks on the row toggle it, except on the upgrade button (RSI opens its overlay then). */
function toggleFrom(event: MouseEvent) {
  if ((event.target as Element).closest('.js-open-ship-upgrades')) return;
  expanded.value = !expanded.value;
}

const usd = (value: number) => formatUsd(value, locale.value);

const discountText = computed(
  () => `−${usd(props.offer.discount)} (${formatPercent(props.offer.percent, locale.value)})`,
);

/** The hangar's colliding CCUs with their discount formatted once. */
const owned = computed(() =>
  props.offer.owned.map((ccu) => ({
    ...ccu,
    shown: ccu.discount && formatDiscount(ccu.discount, locale.value),
  })),
);

/** The hangar's CCUs to this very ship, and its other CCUs that can't be chained with it. */
const counts = computed(() => ownedCounts(props.offer));

/** A count of the tables; nothing for none, so the counts that matter stand out. */
const count = (value: number) => (value ? String(value) : '–');
</script>

<template>
  <div class="shm-row shm-warbond" :class="{ 'is-expanded': expanded }">
    <div class="shm-row-summary" @click="toggleFrom">
      <span class="shm-thumb">
        <img
          v-if="offer.target.ship.image"
          :src="offer.target.ship.image"
          alt=""
          loading="lazy"
          decoding="async"
          width="128"
          height="72"
        />
      </span>

      <span class="shm-main">
        <span class="shm-title">{{ offer.target.ship.name }}</span>
        <span class="shm-original">{{ i18n.t('store.warbondEdition') }}</span>
        <span class="shm-meta">
          <span class="shm-warbond-price">{{ usd(offer.target.price) }}</span>
          <s class="shm-warbond-msrp" :title="i18n.t('store.msrpHint')">
            {{ usd(offer.target.ship.msrp) }}
          </s>
          <span class="shm-discount">{{ discountText }}</span>
        </span>
      </span>

      <!-- Only with at least one tag: "In hangar:", then the tags. -->
      <span v-if="counts.sameShip || counts.others" class="shm-badges shm-warbond-badges">
        <span class="shm-warbond-badges-label">{{ i18n.t('store.inHangar') }}</span>
        <span
          v-if="counts.sameShip"
          class="shm-badge shm-warbond-owned"
          :title="i18n.t('store.sameShipBadgeHint', [offer.target.ship.name])"
        >
          {{ i18n.t('store.sameShipBadge', [counts.sameShip, offer.target.ship.name]) }}
        </span>
        <span
          v-if="counts.others"
          class="shm-badge shm-warbond-owned"
          :title="i18n.t('store.collidingBadgeHint')"
        >
          {{ i18n.t('store.collidingBadge', [counts.others]) }}
        </span>
      </span>

      <!-- RSI's own opener (a click handler on the page): its overlay, with this warbond as target. -->
      <a
        href="#"
        class="shm-button shm-warbond-upgrade js-open-ship-upgrades"
        data-apiurl="/pledge-store/api/upgrade/v2"
        :data-toshipid="offer.target.ship.id"
        :data-toskuid="offer.target.skuId"
        :title="i18n.t('store.openUpgradeHint', [offer.target.ship.name])"
        @click.prevent
      >
        <SvgIcon name="basket-shopping" />
        {{ i18n.t('store.openUpgrade') }}
      </a>

      <button
        type="button"
        class="shm-chevron"
        :aria-expanded="expanded"
        :aria-label="i18n.t('pledge.toggleDetails')"
        :title="i18n.t('pledge.toggleDetails')"
        @click.stop="expanded = !expanded"
      >
        <SvgIcon name="chevron-right" />
      </button>
    </div>

    <div v-if="expanded" class="shm-details shm-warbond-details">
      <div class="shm-details-main">
        <h4 class="shm-warbond-heading">{{ i18n.t('store.cheapestTitle') }}</h4>
        <p v-if="!offer.bases.length" class="shm-hint">{{ i18n.t('store.noBases') }}</p>
        <template v-else>
          <p class="shm-hint">{{ i18n.t('store.cheapestHint') }}</p>
          <table class="shm-warbond-table">
            <thead>
              <tr>
                <th scope="col" class="is-number">{{ i18n.t('store.colCcu') }}</th>
                <th scope="col">{{ i18n.t('store.colFrom') }}</th>
                <th scope="col" class="is-number">{{ i18n.t('store.colShipPrice') }}</th>
                <th scope="col" class="is-number is-group">
                  {{ i18n.t('store.colHangarShips') }}
                </th>
                <th scope="col" class="is-number">{{ i18n.t('store.colHangarCcus') }}</th>
                <th scope="col" class="is-number is-group">
                  {{ i18n.t('store.colBuybackShips') }}
                </th>
                <th scope="col" class="is-number">{{ i18n.t('store.colBuybackCcus') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="base in offer.bases" :key="base.ship.id">
                <td class="is-number is-strong">{{ usd(base.ccuPrice) }}</td>
                <td>{{ base.ship.name }}</td>
                <td class="is-number">{{ usd(base.ship.msrp) }}</td>
                <td class="is-number is-group" :class="{ 'is-none': !base.holdings.hangarShips }">
                  {{ count(base.holdings.hangarShips) }}
                </td>
                <td class="is-number" :class="{ 'is-none': !base.holdings.hangarCcus }">
                  {{ count(base.holdings.hangarCcus) }}
                </td>
                <td class="is-number is-group" :class="{ 'is-none': !base.holdings.buybackShips }">
                  {{ count(base.holdings.buybackShips) }}
                </td>
                <td class="is-number" :class="{ 'is-none': !base.holdings.buybackCcus }">
                  {{ count(base.holdings.buybackCcus) }}
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <h4 class="shm-warbond-heading">
          {{ i18n.t('store.ownedTitle', [usd(offer.target.price), usd(offer.target.ship.msrp)]) }}
        </h4>
        <p class="shm-hint">{{ i18n.t('store.ownedHint') }}</p>
        <p v-if="!owned.length" class="shm-hint">{{ i18n.t('store.ownedNone') }}</p>
        <table v-else class="shm-warbond-table is-small">
          <thead>
            <tr>
              <th scope="col">{{ i18n.t('store.colCcu') }}</th>
              <th scope="col" class="is-number">{{ i18n.t('store.colShipPrices') }}</th>
              <th scope="col" class="is-number">{{ i18n.t('store.colCount') }}</th>
              <th scope="col" class="is-number shm-value">{{ i18n.t('store.colValue') }}</th>
              <th scope="col" class="is-number shm-value">{{ i18n.t('store.colDiscount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ccu in owned" :key="ccu.ids[0]">
              <td>{{ ccu.from.name }} → {{ ccu.to.name }}</td>
              <td class="is-number is-muted">
                {{ usd(ccu.from.price) }} → {{ usd(ccu.to.price) }}
              </td>
              <td class="is-number">{{ ccu.ids.length }}×</td>
              <td class="is-number shm-value">{{ usd(ccu.valueUsd) }}</td>
              <td class="is-number shm-value">
                <span
                  v-if="ccu.shown"
                  class="shm-discount"
                  :class="{ 'is-surcharge': ccu.shown.isSurcharge }"
                  :title="ccu.shown.title"
                >
                  {{ ccu.shown.text }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style src="@/hangar/components/row.css"></style>

<style scoped>
.shm-warbond-price {
  color: var(--shm-text-strong);
}

.shm-warbond-msrp {
  color: var(--shm-text-muted);
}

/* One line each; a tag too long for the row ends with "…" (the tooltip explains it). */
.shm-warbond-owned {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

/* "In hangar:" before the tags, in the type of the meta line. */
.shm-warbond-badges {
  flex: 0 1 auto;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

/*
 * Beside the title (RSI theme) the tags wrap instead of squeezing the ship's name, e.g. next to
 * "2 to Constellation Mk V Centaurus".
 */
.shm-warbond .shm-main {
  min-width: 40%;
}

.shm-warbond-badges-label {
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

/* The upgrade button on the right, next to the chevron, its label on one line. */
.shm-warbond-upgrade {
  flex: none;
  white-space: nowrap;
}

/* No buttons under the image here: the content spans both columns. */
.shm-warbond-details .shm-details-main {
  grid-column: 1 / -1;
}

.shm-warbond-heading {
  margin: 10px 0 4px;
  color: var(--shm-accent);
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: normal;
  text-transform: uppercase;
}

/* Tables like the CCU history's (UpgradeLog.vue): numbers right-aligned, so they line up. */
.shm-warbond-table {
  width: 100%;
  margin: 0 0 6px;
  border-collapse: collapse;
}

.shm-warbond-table th,
.shm-warbond-table td {
  padding: 3px 0 3px 12px;
  text-align: left;
  vertical-align: top;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.08);
}

.shm-warbond-table :is(th, td):first-child {
  padding-left: 0;
}

.shm-warbond-table th {
  color: var(--shm-text-muted);
  font-weight: normal;
  border-top: 0;
}

.shm-warbond-table .is-number {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* Space before each pair of count columns (hangar, buy back). */
.shm-warbond-table .is-group {
  padding-left: 24px;
}

.shm-warbond-table .is-strong {
  color: var(--shm-text-strong);
}

.shm-warbond-table .is-muted,
.shm-warbond-table .is-none {
  color: var(--shm-text-muted);
}

/* The hangar's CCUs: small, they are a reference. */
.shm-warbond-table.is-small {
  font-size: calc(11px * var(--shm-font-scale));
}
</style>

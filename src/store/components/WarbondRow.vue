<script setup lang="ts">
import { formatDiscount, formatPercent, formatUsd } from '@/hangar/discount-format';
import SvgIcon from '@/icons/SvgIcon.vue';
import { localized } from '@/events/events';
import { i18n, locale } from '@/i18n';
import { computed, ref } from 'vue';
import { ownedCounts, type WarbondOffer } from '../warbond';
import type { SightingEvent } from '../warbond-history';
import { vTooltip } from '@/shared/tooltip/tooltip';
import BaseShipsTable from './BaseShipsTable.vue';
import ShipUpgradeButtons from './ShipUpgradeButtons.vue';
import SortableTh from '@/shared/components/SortableTh.vue';
import { nextSort } from '@/shared/table-sort';
import {
  OWNED_CCU_SORT_COLUMNS,
  sortOwnedCcus,
  type OwnedCcuColumn,
  type OwnedCcuSort,
} from '../owned-ccu-sort';
// Shared, unscoped styles of the store's tables; a plain import, as `<style src>` of the same file
// in several components breaks the build.
import './store-table.css';

const props = defineProps<{
  offer: WarbondOffer;
  /** The order of "Your CCUs between" (#395), the same for every warbond CCU. */
  ownedSort?: OwnedCcuSort | null;
}>();

const emit = defineEmits<{ 'update:ownedSort': [sort: OwnedCcuSort] }>();

/** A click on a column head: sorts by it, a second click reverses the order. */
const sortBy = (column: OwnedCcuColumn) =>
  emit('update:ownedSort', nextSort(props.ownedSort, column, OWNED_CCU_SORT_COLUMNS[column].first));

const expanded = ref(false);

/** Clicks on the row toggle it, except on the upgrade button (RSI opens its overlay then). */
function toggleFrom(event: MouseEvent) {
  if ((event.target as Element).closest('.shm-upgrade-buttons')) return;
  expanded.value = !expanded.value;
}

const usd = (value: number) => formatUsd(value, locale.value);

const discountText = computed(
  () => `−${usd(props.offer.discount)} (${formatPercent(props.offer.percent, locale.value)})`,
);

/**
 * The hangar's colliding CCUs in the chosen order, with their discount formatted once: the amount
 * and the percentage in columns of their own (#395).
 */
const owned = computed(() =>
  sortOwnedCcus(props.offer.owned, props.ownedSort).map((ccu) => {
    const shown = ccu.discount && formatDiscount(ccu.discount, locale.value);
    const sign = !ccu.discount?.amount ? '' : shown?.isSurcharge ? '+' : '−';
    return {
      ...ccu,
      shown: shown && {
        ...shown,
        amount: `${sign}${usd(Math.abs(ccu.discount!.amount))}`,
        percent: `${sign}${formatPercent(Math.abs(ccu.discount!.percent), locale.value)}`,
      },
    };
  }),
);

/** The hangar's CCUs to this very ship, and its other CCUs that can't be chained with it. */
const counts = computed(() => ownedCounts(props.offer));

const dates = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }));
const eventNames = (events: readonly SightingEvent[]) =>
  events.map((event) => localized(event.name, locale.value)).join(', ');

/** Since when the offer is seen, during which events (#4). */
const since = computed(() => {
  const { since, events } = props.offer.history;
  if (since === undefined) return undefined;
  const date = dates.value.format(since);
  return events.length
    ? i18n.t('store.historySinceEvent', [date, eventNames(events)])
    : i18n.t('store.historySince', [date]);
});

/** Since when, then what the history is: one text, so the space between them stays. */
const historyIntro = computed(() =>
  [since.value, i18n.t('store.historyHint')].filter(Boolean).join(' '),
);

/** The earlier offers of the ship, formatted once. */
const earlier = computed(() =>
  props.offer.history.earlier.map((sighting) => {
    const discount = sighting.msrp - sighting.price;
    return {
      key: `${sighting.skuId}|${sighting.firstSeen}`,
      seen: dates.value.formatRange(sighting.firstSeen, sighting.lastSeen),
      price: usd(sighting.price),
      msrp: usd(sighting.msrp),
      discount:
        sighting.msrp > 0
          ? `−${usd(discount)} (${formatPercent((discount / sighting.msrp) * 100, locale.value)})`
          : '',
      events: eventNames(sighting.events ?? []),
    };
  }),
);
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
          <s v-tooltip="i18n.t('store.msrpHint')" class="shm-warbond-msrp">
            {{ usd(offer.target.ship.msrp) }}
          </s>
          <span class="shm-discount">{{ discountText }}</span>
        </span>
      </span>

      <!-- Only with at least one tag: "In hangar:", then the tags. -->
      <span
        v-if="counts.sameShip || offer.fromShip || counts.others"
        class="shm-badges shm-warbond-badges"
      >
        <span class="shm-warbond-badges-label">{{ i18n.t('store.inHangar') }}</span>
        <span
          v-if="counts.sameShip"
          v-tooltip="i18n.t('store.sameShipBadgeHint', [offer.target.ship.name])"
          class="shm-badge shm-warbond-owned"
        >
          {{ i18n.t('store.sameShipBadge', [counts.sameShip, offer.target.ship.name]) }}
        </span>
        <!-- The hangar's CCUs from this ship (#399). -->
        <span
          v-if="offer.fromShip"
          v-tooltip="i18n.t('store.fromShipBadgeHint', [offer.target.ship.name])"
          class="shm-badge shm-warbond-owned shm-warbond-from"
        >
          {{ i18n.t('store.fromShipBadge', [offer.fromShip, offer.target.ship.name]) }}
        </span>
        <span
          v-if="counts.others"
          v-tooltip="i18n.t('store.collidingBadgeHint')"
          class="shm-badge shm-warbond-owned"
        >
          {{ i18n.t('store.collidingBadge', [counts.others]) }}
        </span>
      </span>

      <!-- RSI's own opener: its overlay, with this warbond as target ("Warbond upgrade", #392). -->
      <ShipUpgradeButtons
        :ship-id="offer.target.ship.id"
        :ship-name="offer.target.ship.name"
        :warbond-sku-id="offer.target.skuId"
      />

      <button
        v-tooltip="i18n.t('pledge.toggleDetails')"
        type="button"
        class="shm-chevron"
        :aria-expanded="expanded"
        :aria-label="i18n.t('pledge.toggleDetails')"
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
          <BaseShipsTable
            :bases="offer.bases"
            :target="{
              shipId: offer.target.ship.id,
              skuId: offer.target.skuId,
              name: `${offer.target.ship.name} (${i18n.t('store.warbondEdition')})`,
            }"
          />
        </template>

        <h4 class="shm-warbond-heading">
          {{ i18n.t('store.ownedTitle', [usd(offer.target.price), usd(offer.target.ship.msrp)]) }}
        </h4>
        <p class="shm-hint">{{ i18n.t('store.ownedHint') }}</p>
        <p v-if="!owned.length" class="shm-hint">{{ i18n.t('store.ownedNone') }}</p>
        <table v-else class="shm-warbond-table is-small">
          <thead>
            <tr>
              <SortableTh column="ccu" :sort="ownedSort" @sort="sortBy">
                {{ i18n.t('store.colCcu') }}
              </SortableTh>
              <SortableTh column="shipPrices" :sort="ownedSort" numeric @sort="sortBy">
                {{ i18n.t('store.colShipPrices') }}
              </SortableTh>
              <SortableTh column="count" :sort="ownedSort" numeric @sort="sortBy">
                {{ i18n.t('store.colCount') }}
              </SortableTh>
              <SortableTh column="value" :sort="ownedSort" numeric class="shm-value" @sort="sortBy">
                {{ i18n.t('store.colValue') }}
              </SortableTh>
              <SortableTh
                column="discount"
                :sort="ownedSort"
                numeric
                class="shm-value"
                @sort="sortBy"
              >
                {{ i18n.t('store.colDiscount') }}
              </SortableTh>
              <SortableTh column="percent" :sort="ownedSort" numeric @sort="sortBy">
                <span
                  v-tooltip="i18n.t('store.colDiscountPercentHint')"
                  :aria-label="i18n.t('store.colDiscountPercentHint')"
                  >{{ i18n.t('store.colDiscountPercent') }}</span
                >
              </SortableTh>
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
                  v-tooltip="ccu.shown.title"
                  class="shm-discount"
                  :class="{ 'is-surcharge': ccu.shown.isSurcharge }"
                >
                  {{ ccu.shown.amount }}
                </span>
              </td>
              <td class="is-number">
                <span
                  v-if="ccu.shown"
                  v-tooltip="ccu.shown.title"
                  class="shm-discount"
                  :class="{ 'is-surcharge': ccu.shown.isSurcharge }"
                >
                  {{ ccu.shown.percent }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <h4 class="shm-warbond-heading">{{ i18n.t('store.historyTitle') }}</h4>
        <p class="shm-hint">{{ historyIntro }}</p>
        <p v-if="!earlier.length" class="shm-hint">{{ i18n.t('store.historyNone') }}</p>
        <table v-else class="shm-warbond-table is-small">
          <thead>
            <tr>
              <th scope="col">{{ i18n.t('store.colSeen') }}</th>
              <th scope="col" class="is-number">{{ i18n.t('store.colPrice') }}</th>
              <th scope="col" class="is-number">{{ i18n.t('store.colDiscount') }}</th>
              <th scope="col">{{ i18n.t('store.colEvent') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sighting in earlier" :key="sighting.key">
              <td>{{ sighting.seen }}</td>
              <td class="is-number">
                {{ sighting.price }}
                <s v-tooltip="i18n.t('store.msrpHint')" class="shm-warbond-msrp">
                  {{ sighting.msrp }}
                </s>
              </td>
              <td class="is-number">
                <span class="shm-discount">{{ sighting.discount }}</span>
              </td>
              <td :class="{ 'is-muted': !sighting.events }">{{ sighting.events || '–' }}</td>
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
</style>

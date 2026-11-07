<script setup lang="ts">
import { PLEDGE_STORE } from '@/config';
import { formatDiscount, formatPercent, formatUsd } from '@/hangar/discount-format';
import SvgIcon from '@/icons/SvgIcon.vue';
import { i18n, locale } from '@/i18n';
import { computed, ref } from 'vue';
import type { BaseLevel, OwnedCcu, WarbondOffer } from '../warbond';

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

/** The first ship names of a level; the others are summed up. */
const levelShips = (level: BaseLevel) => {
  const shown = level.ships.slice(0, PLEDGE_STORE.shipsPerLevel).map((ship) => ship.name);
  const more = level.ships.length - shown.length;
  return more > 0 ? [...shown, i18n.t('store.moreShips', [more])].join(', ') : shown.join(', ');
};

const ownedCount = computed(() =>
  props.offer.owned.reduce((count, ccu) => count + ccu.ids.length, 0),
);

const ownedDiscount = (ccu: OwnedCcu) => ccu.discount && formatDiscount(ccu.discount, locale.value);
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

      <span class="shm-badges">
        <span
          v-if="ownedCount"
          class="shm-badge shm-warbond-owned"
          :title="i18n.t('store.ownedBadgeHint')"
        >
          {{ i18n.t('store.ownedBadge', [ownedCount]) }}
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
        <ul v-else class="shm-items">
          <li v-for="level in offer.bases" :key="level.msrp">
            <span class="shm-warbond-ccu-price">{{
              i18n.t('store.ccuPrice', [usd(level.ccuPrice)])
            }}</span>
            <span class="shm-item-title">
              {{ i18n.t('store.fromShips', [levelShips(level), usd(level.msrp)]) }}
            </span>
          </li>
        </ul>

        <template v-if="offer.range">
          <h4 class="shm-warbond-heading">
            {{ i18n.t('store.ownedTitle', [usd(offer.range.low), usd(offer.range.high)]) }}
          </h4>
          <p class="shm-hint">{{ i18n.t('store.ownedHint') }}</p>
          <p v-if="!offer.owned.length" class="shm-hint">{{ i18n.t('store.ownedNone') }}</p>
          <ul v-else class="shm-items shm-warbond-owned-list">
            <li v-for="ccu in offer.owned" :key="ccu.ids[0]">
              <span class="shm-item-title">
                {{ ccu.from.name }} → {{ ccu.to.name }}
                <span class="shm-item-kind">
                  ({{ usd(ccu.from.price) }} → {{ usd(ccu.to.price) }})
                </span>
                <template v-if="ccu.ids.length > 1"> × {{ ccu.ids.length }}</template>
              </span>
              <span class="shm-value">{{ ccu.value }}</span>
              <span
                v-if="ownedDiscount(ccu)"
                class="shm-discount"
                :class="{ 'is-surcharge': ownedDiscount(ccu)!.isSurcharge }"
                :title="ownedDiscount(ccu)!.title"
              >
                {{ ownedDiscount(ccu)!.text }}
              </span>
            </li>
          </ul>
        </template>
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

.shm-warbond-owned {
  cursor: help;
}

/* The upgrade button keeps its label on one line, next to the chevron. */
.shm-warbond .shm-row-summary > .shm-button {
  flex: none;
  white-space: nowrap;
}

/* No buttons under the image here: the content spans both columns. */
.shm-warbond-details .shm-details-main {
  grid-column: 1 / -1;
}

.shm-warbond-heading {
  margin: 8px 0 4px;
  color: var(--shm-accent);
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: normal;
  text-transform: uppercase;
}

.shm-warbond-ccu-price {
  flex: none;
  min-width: 90px;
  color: var(--shm-text-strong);
  font-variant-numeric: tabular-nums;
}

/* The hangar's CCUs: small, they are a reference. */
.shm-warbond-owned-list {
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-warbond-owned-list .shm-value,
.shm-warbond-owned-list .shm-discount {
  flex: none;
  font-variant-numeric: tabular-nums;
}
</style>

<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import BaseShipsTable from '@/store/components/BaseShipsTable.vue';
import { computed, ref } from 'vue';
import type { SecureOffer } from '../ccus-to-secure';
import { formatExpectedTime } from '../price-increase-label';
import PriceIncreaseBadge from './PriceIncreaseBadge.vue';

/**
 * A ship whose price is expected to rise, in the Pledge Store tab (#253): its price now and after,
 * the countdown, RSI's upgrade dialog with it as target, and – opened – the cheapest CCUs to it,
 * each gaining the price increase as discount. Laid out like the warbond CCUs (WarbondRow.vue).
 */
const props = defineProps<{ offer: SecureOffer }>();

const expanded = ref(false);

/** Clicks on the row toggle it, except on the upgrade button (RSI opens its overlay then). */
function toggleFrom(event: MouseEvent) {
  if ((event.target as Element).closest('.js-open-ship-upgrades')) return;
  expanded.value = !expanded.value;
}

const usd = (value: number) => formatUsd(value, locale.value);
const match = computed(() => ({ increase: props.offer.increase, reason: 'ship' as const }));
const when = computed(() => formatExpectedTime(props.offer.increase.priceIncreaseAt, locale.value));
</script>

<template>
  <div class="shm-row shm-warbond shm-secure" :class="{ 'is-expanded': expanded }">
    <div class="shm-row-summary" @click="toggleFrom">
      <span class="shm-thumb">
        <img
          v-if="offer.ship.image"
          :src="offer.ship.image"
          alt=""
          loading="lazy"
          decoding="async"
          width="128"
          height="72"
        />
      </span>

      <span class="shm-main">
        <span class="shm-title">{{ offer.ship.name }}</span>
        <span class="shm-meta">
          <span v-if="offer.increase.price" class="shm-secure-price">
            {{ usd(offer.increase.price.from) }} → {{ usd(offer.increase.price.to) }}
          </span>
          <span v-else class="shm-secure-price">{{ usd(offer.price) }}</span>
        </span>
      </span>

      <span class="shm-badges">
        <PriceIncreaseBadge :match="match" place="hangar" />
      </span>

      <!-- RSI's own opener (a click handler on the page): its overlay, with this ship as target. -->
      <a
        v-tooltip="i18n.t('ccusToSecure.openUpgradeHint', [offer.ship.name])"
        href="#"
        class="shm-button shm-warbond-upgrade js-open-ship-upgrades"
        data-apiurl="/pledge-store/api/upgrade/v2"
        :data-toshipid="offer.ship.id"
        :data-toskuid="offer.skuId"
        @click.prevent
      >
        <SvgIcon name="basket-shopping" />
        {{ i18n.t('store.openUpgrade') }}
      </a>

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
        <h4 class="shm-warbond-heading">
          {{ i18n.t('ccusToSecure.cheapestTitle', [offer.ship.name]) }}
        </h4>
        <p class="shm-hint">
          {{
            offer.gain
              ? i18n.t('ccusToSecure.gainHint', [usd(offer.gain), when])
              : i18n.t('ccusToSecure.gainUnknownHint', [when])
          }}
        </p>
        <p v-if="!offer.bases.length" class="shm-hint">
          {{ i18n.t('ccusToSecure.noBases', [offer.ship.name]) }}
        </p>
        <BaseShipsTable v-else :bases="offer.bases" />
      </div>
    </div>
  </div>
</template>

<style src="@/hangar/components/row.css"></style>

<style scoped>
.shm-secure-price {
  color: var(--shm-text-strong);
  font-variant-numeric: tabular-nums;
}

.shm-secure .shm-main {
  min-width: 40%;
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

/* As the warbond CCUs' heading (WarbondRow.vue); Modern Hangar adjusts both in modern.css. */
.shm-warbond-heading {
  margin: 10px 0 4px;
  color: var(--shm-accent);
  font-size: calc(12px * var(--shm-font-scale));
  font-weight: normal;
  text-transform: uppercase;
}
</style>

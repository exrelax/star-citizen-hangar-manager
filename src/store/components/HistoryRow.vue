<script setup lang="ts">
import { localized } from '@/events/events';
import { formatPercent, formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import type { HistoryEntry } from '../warbond-history-view';

/*
 * An expired warbond offer of the "Warbond CCU History" (#297): the ship with its warbond price,
 * standard price and discount as in the current offers, then when it was seen and during which
 * events. Nothing to open: RSI no longer sells it.
 */

const props = defineProps<{ entry: HistoryEntry }>();

const usd = (value: number) => formatUsd(value, locale.value);
const sighting = computed(() => props.entry.sighting);

const discountText = computed(
  () => `−${usd(props.entry.discount)} (${formatPercent(props.entry.percent, locale.value)})`,
);

const seen = computed(() =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).formatRange(
    sighting.value.firstSeen,
    sighting.value.lastSeen,
  ),
);

const events = computed(() =>
  (sighting.value.events ?? []).map((event) => ({
    id: event.id,
    name: localized(event.name, locale.value),
  })),
);
</script>

<template>
  <div class="shm-row shm-warbond-past">
    <div class="shm-row-summary">
      <span class="shm-thumb">
        <img
          v-if="entry.ship?.image"
          :src="entry.ship.image"
          alt=""
          loading="lazy"
          decoding="async"
          width="128"
          height="72"
        />
      </span>

      <span class="shm-main">
        <span class="shm-title">{{ sighting.shipName }}</span>
        <span class="shm-original">
          {{ i18n.t('store.warbondEdition')
          }}<template v-if="entry.manufacturer"> · {{ entry.manufacturer }}</template>
        </span>
        <span class="shm-meta">
          <span class="shm-past-price">{{ usd(sighting.price) }}</span>
          <s v-tooltip="i18n.t('store.msrpHint')" class="shm-past-msrp">
            {{ usd(sighting.msrp) }}
          </s>
          <span class="shm-discount">{{ discountText }}</span>
        </span>
      </span>

      <span class="shm-badges shm-past-badges">
        <span class="shm-past-seen">{{ i18n.t('store.historySeen', [seen]) }}</span>
        <span v-for="event in events" :key="event.id" class="shm-badge">{{ event.name }}</span>
      </span>
    </div>
  </div>
</template>

<style src="@/hangar/components/row.css"></style>

<style scoped>
/* Nothing to open or click. */
.shm-warbond-past .shm-row-summary {
  cursor: default;
}

.shm-warbond-past .shm-row-summary:hover {
  background: none;
}

.shm-past-price {
  color: var(--shm-text-strong);
}

.shm-past-msrp {
  color: var(--shm-text-muted);
}

.shm-past-badges {
  flex: 0 1 auto;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.shm-past-seen {
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}
</style>

<script setup lang="ts">
import { formatPercent, formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import { HIDDEN } from '@/orders/orders';
import { useSettings } from '@/settings/use-settings';
import { computed } from 'vue';
import type { CardShip, CoverageCard } from '../coverage-card';
import type { CoverageMatch } from '../coverage';

/*
 * The card of an entry under "Base ship" (#426), shown by the tooltip: the pledge's title and id,
 * its ships with image and price (a CCU: base ship → target ship), its value, discount and whether
 * it is giftable. "Hide $ amounts" and "Hide pledge IDs" apply.
 */

const props = defineProps<{ match: CoverageMatch; card: CoverageCard }>();
const { settings } = useSettings();

const hide = computed(() => settings.value.hideMeltValue);
const money = (value: number | undefined) =>
  value === undefined ? undefined : hide.value ? HIDDEN : formatUsd(value, locale.value);
const id = computed(() =>
  settings.value.hidePledgeIds ? HIDDEN : (props.match.displayId ?? props.match.id),
);
const ships = computed((): { ship: CardShip; role?: 'from' | 'to' }[] =>
  props.card.from || props.card.to
    ? [
        ...(props.card.from ? [{ ship: props.card.from, role: 'from' as const }] : []),
        ...(props.card.to ? [{ ship: props.card.to, role: 'to' as const }] : []),
      ]
    : props.card.ships.map((ship) => ({ ship })),
);
const discount = computed(() => {
  const value = props.card.discount;
  if (!value || value.amount === 0) return undefined;
  const surcharge = value.amount < 0;
  return {
    surcharge,
    text: hide.value
      ? HIDDEN
      : `${surcharge ? '+' : '−'}${formatUsd(Math.abs(value.amount), locale.value)} (${formatPercent(Math.abs(value.percent), locale.value)})`,
  };
});
const valueLabel = computed(() =>
  i18n.t(
    props.match.source === 'buyback' ? 'ccuCoverage.card.buybackPrice' : 'ccuCoverage.card.value',
  ),
);
const giftable = computed(() =>
  i18n.t(
    `ccuCoverage.card.${props.match.source === 'buyback' ? 'probablyGiftable' : 'giftable'}.${props.card.giftable ? 'yes' : 'no'}`,
  ),
);
</script>

<template>
  <div class="shm-coverage-card">
    <p class="shm-coverage-card-head">
      <strong>{{ match.title }}</strong>
      <span class="shm-pledge-id">#{{ id }}</span>
    </p>
    <ul v-if="ships.length" class="shm-coverage-card-ships">
      <li v-for="(entry, index) in ships" :key="index">
        <span class="shm-coverage-card-image">
          <img v-if="entry.ship.image" :src="entry.ship.image" alt="" width="72" height="40" />
        </span>
        <span class="shm-coverage-card-ship">
          <span v-if="entry.role" class="shm-coverage-card-role">
            {{ i18n.t(`ccuCoverage.card.${entry.role}`) }}
          </span>
          <span class="shm-coverage-card-name">{{ entry.ship.name }}</span>
        </span>
        <span class="shm-coverage-card-price">{{ money(entry.ship.price) ?? '–' }}</span>
      </li>
    </ul>
    <dl class="shm-coverage-card-facts">
      <template v-if="card.value !== undefined">
        <dt>{{ valueLabel }}</dt>
        <dd>{{ money(card.value) }}</dd>
      </template>
      <template v-if="discount">
        <dt>
          {{
            i18n.t(discount.surcharge ? 'ccuCoverage.card.surcharge' : 'ccuCoverage.card.discount')
          }}
        </dt>
        <dd :class="discount.surcharge ? 'is-surcharge' : 'is-discount'">{{ discount.text }}</dd>
      </template>
      <dt>{{ i18n.t('ccuCoverage.card.gift') }}</dt>
      <dd>{{ giftable }}</dd>
    </dl>
  </div>
</template>

<style>
/* Shown in the tooltip overlay, outside the manager: not scoped, prefixed instead. */
.shm-coverage-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 260px;
}

.shm-coverage-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  margin: 0;
}

.shm-tooltip .shm-coverage-card-head strong {
  display: inline;
  margin: 0;
}

.shm-coverage-card-head .shm-pledge-id {
  color: var(--shm-text-muted);
}

.shm-coverage-card-ships {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-coverage-card-ships li {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.shm-coverage-card-image {
  width: 72px;
  height: 40px;
  overflow: hidden;
  background: rgb(var(--shm-accent-rgb) / 0.08);
}

.shm-coverage-card-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shm-coverage-card-ship {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.shm-coverage-card-role {
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale, 1));
}

.shm-coverage-card-name {
  color: var(--shm-text);
}

.shm-coverage-card-price,
.shm-coverage-card-facts dd {
  color: var(--shm-text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.shm-coverage-card-facts {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 3px 12px;
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-coverage-card-facts dt {
  color: var(--shm-text-muted);
}

.shm-coverage-card-facts dd {
  margin: 0;
}

.shm-coverage-card-facts dd.is-discount {
  color: var(--shm-success);
}

.shm-coverage-card-facts dd.is-surcharge {
  color: var(--shm-warning);
}

.shm-theme-modern .shm-coverage-card-image {
  border-radius: var(--shm-radius-small);
}
</style>

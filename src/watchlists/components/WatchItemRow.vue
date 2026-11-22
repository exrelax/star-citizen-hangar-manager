<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { insuranceLabel } from '@/hangar/insurance';
import { i18n, locale } from '@/i18n';
import type { IconName, IconSet } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import type { StoreStatus } from '../store-status';
import type { PlainItem } from '../watchlist-view';
import { isStoreItem, WATCHLIST_LIMITS } from '../watchlists';

/*
 * An item of a watchlist without a row of the lists (#467): a pledge gone from My Hangar or the Buy
 * Back, or not read yet, and a Pledge Store item (#470). A pledge shows the name and value it had
 * when last seen, and where it is now; a store item its count, which can be changed, its price now
 * (the one when last seen while that isn't known) and whether it can be bought now. Its button
 * removes it from the watchlist.
 */

const props = defineProps<{
  entry: PlainItem;
  /** A store item's price and availability now (`store-status.ts`). */
  status?: StoreStatus;
}>();
const emit = defineEmits<{ remove: []; count: [count: number] }>();
/** `actions`: more buttons before the one that removes it, e.g. into the cart (#529). */
defineSlots<{ actions?(): unknown }>();

const ICONS: Record<PlainItem['item']['kind'], { name: IconName; set?: IconSet }> = {
  hangar: { name: 'hangar', set: 'custom' },
  buyback: { name: 'recycle' },
  storeCcu: { name: 'square-up-right' },
  storePaint: { name: 'palette' },
  storeShip: { name: 'shuttle-space' },
};
const icon = computed(() => ICONS[props.entry.item.kind]);
const store = computed(() => isStoreItem(props.entry.item));
const count = computed(() => props.entry.item.count ?? 1);

const usd = (value: number) => formatUsd(value, locale.value);
/** The price of all of them: now, else when last seen. */
const value = computed(() => {
  const each = props.status?.price ?? props.entry.item.value;
  return each === undefined ? undefined : usd(each * count.value);
});
const warbond = computed(() =>
  props.status?.warbondPrice === undefined
    ? undefined
    : i18n.t('watchlists.warbondPrice', [usd(props.status.warbondPrice * count.value)]),
);

/** Where a pledge stands that has no row: gone, and where it is now. */
const note = computed(() => {
  const { item, presence } = props.entry;
  if (presence.state !== 'gone') return undefined;
  if (presence.nowIn) return i18n.t(`watchlists.nowIn.${presence.nowIn}`);
  return i18n.t(item.kind === 'hangar' ? 'watchlists.gone.hangar' : 'watchlists.gone.buyback');
});

/** Whether a store item can be bought now. */
const sale = computed(() => {
  const status = props.status;
  if (!store.value || !status) return undefined;
  if (status.impossible) return { text: i18n.t('watchlists.notSellable'), tone: 'is-danger' };
  if (status.onSale === undefined) return undefined;
  return status.onSale
    ? { text: i18n.t('watchlists.onSale'), tone: 'is-success' }
    : { text: i18n.t('watchlists.notOnSale'), tone: 'is-muted' };
});

/** A standalone ship's insurance, e.g. of a pledge to rebuy (#531). */
const insurance = computed(() => {
  const { item } = props.entry;
  if (item.kind !== 'storeShip' || item.insurance === undefined) return undefined;
  return item.insurance === 'lti'
    ? insuranceLabel({ lifetime: true })
    : insuranceLabel({ lifetime: false, months: item.insurance });
});

const setCount = (next: number) =>
  next >= 1 && next <= WATCHLIST_LIMITS.count && next !== count.value && emit('count', next);
</script>

<template>
  <div class="shm-row shm-watch-item" :class="{ 'is-gone': entry.presence.state === 'gone' }">
    <span class="shm-watch-item-icon" aria-hidden="true">
      <SvgIcon :name="icon.name" :set="icon.set" />
    </span>
    <span class="shm-watch-item-text">
      <span class="shm-watch-item-name">
        {{ entry.item.name }}
        <span v-if="insurance" class="shm-badge is-insurance">{{ insurance }}</span>
      </span>
      <span v-if="note" class="shm-watch-item-note">{{ note }}</span>
      <span v-if="sale || warbond" class="shm-watch-item-status">
        <span v-if="sale" :class="sale.tone">{{ sale.text }}</span>
        <span v-if="warbond" class="shm-value">{{ warbond }}</span>
      </span>
    </span>
    <span class="shm-watch-item-figures">
      <!-- A store item's count, e.g. a CCU to buy several times (#470). -->
      <span
        v-if="store"
        class="shm-watch-item-stepper"
        role="group"
        :aria-label="i18n.t('watchlists.count')"
      >
        <button
          v-tooltip="i18n.t('watchlists.countLess')"
          type="button"
          :aria-label="i18n.t('watchlists.countLess')"
          :disabled="count <= 1"
          @click="setCount(count - 1)"
        >
          −
        </button>
        <span class="shm-watch-item-count" aria-live="polite">×{{ count }}</span>
        <button
          v-tooltip="i18n.t('watchlists.countMore')"
          type="button"
          :aria-label="i18n.t('watchlists.countMore')"
          :disabled="count >= WATCHLIST_LIMITS.count"
          @click="setCount(count + 1)"
        >
          +
        </button>
      </span>
      <span v-else-if="count > 1" class="shm-watch-item-count">×{{ count }}</span>
      <span v-if="value" class="shm-value">{{ value }}</span>
    </span>
    <slot name="actions" />
    <button
      v-tooltip="i18n.t('watchlists.remove')"
      type="button"
      class="shm-watch-item-remove"
      :aria-label="i18n.t('watchlists.removeItem', [entry.item.name])"
      @click="emit('remove')"
    >
      <SvgIcon name="xmark" />
    </button>
  </div>
</template>

<style src="@/hangar/components/row.css"></style>

<style>
.shm-row.shm-watch-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 0 0 0 12px;
  content-visibility: visible;
}

.shm-watch-item-icon {
  display: inline-flex;
  flex: none;
  color: var(--shm-accent);
}

.shm-watch-item.is-gone .shm-watch-item-icon,
.shm-watch-item.is-gone .shm-watch-item-name {
  color: var(--shm-text-muted);
}

.shm-watch-item-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.shm-watch-item-name {
  overflow: hidden;
  color: var(--shm-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shm-watch-item-note {
  color: var(--shm-warning);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-watch-item-figures {
  display: inline-flex;
  flex: none;
  gap: 10px;
  color: var(--shm-text-secondary);
  font-variant-numeric: tabular-nums;
}

.shm-watch-item-count {
  color: var(--shm-text-muted);
}

.shm-watch-item-status {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-watch-item-status .is-success {
  color: var(--shm-success);
}

.shm-watch-item-status .is-muted {
  color: var(--shm-text-muted);
}

.shm-watch-item-status .is-danger {
  color: var(--shm-danger);
}

/* − ×2 + : small buttons, each with a hit area of 44 × 44 px around it. */
.shm-watch-item-stepper {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.shm-watch-item-stepper button {
  position: relative;
  width: 22px;
  height: 22px;
  padding: 0;
  color: var(--shm-accent);
  font: inherit;
  line-height: 1;
  background: rgb(var(--shm-accent-rgb) / 0.12);
  border: 0;
  border-radius: var(--shm-radius-small);
  cursor: pointer;
}

.shm-watch-item-stepper button::before {
  position: absolute;
  inset: -11px -4px;
  content: '';
}

.shm-watch-item-stepper button:disabled {
  opacity: 0.4;
  cursor: default;
}

.shm-watch-item-stepper button:not(:disabled):hover,
.shm-watch-item-stepper button:focus-visible {
  background: rgb(var(--shm-accent-rgb) / 0.25);
  outline: none;
}

.shm-watch-item-stepper .shm-watch-item-count {
  min-width: 28px;
  text-align: center;
}

/* At least 44 × 44 px to hit (Apple Human Interface Guidelines). */
.shm-watch-item-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  color: var(--shm-text-muted);
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-watch-item-remove:hover,
.shm-watch-item-remove:focus-visible {
  color: var(--shm-danger);
  outline: none;
}
</style>

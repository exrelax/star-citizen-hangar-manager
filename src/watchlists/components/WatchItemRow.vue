<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import type { IconName, IconSet } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import type { PlainItem } from '../watchlist-view';

/*
 * An item of a watchlist without a row of the lists (#467): a pledge gone from My Hangar or the Buy
 * Back, or not read yet, and a Pledge Store item. It shows the name and value it had when last seen,
 * a store item's count, and where a pledge gone is now; its button removes it from the watchlist.
 */

const props = defineProps<{ entry: PlainItem }>();
const emit = defineEmits<{ remove: [] }>();

const ICONS: Record<PlainItem['item']['kind'], { name: IconName; set?: IconSet }> = {
  hangar: { name: 'hangar', set: 'custom' },
  buyback: { name: 'recycle' },
  storeCcu: { name: 'square-up-right' },
  storePaint: { name: 'palette' },
};
const icon = computed(() => ICONS[props.entry.item.kind]);

const value = computed(() => {
  const { value, count } = props.entry.item;
  if (value === undefined) return undefined;
  return formatUsd(value * (count ?? 1), locale.value);
});

/** Where a pledge stands that has no row: gone, and where it is now. */
const note = computed(() => {
  const { item, presence } = props.entry;
  if (presence.state !== 'gone') return undefined;
  if (presence.nowIn) return i18n.t(`watchlists.nowIn.${presence.nowIn}`);
  return i18n.t(item.kind === 'hangar' ? 'watchlists.gone.hangar' : 'watchlists.gone.buyback');
});
</script>

<template>
  <div class="shm-row shm-watch-item" :class="{ 'is-gone': entry.presence.state === 'gone' }">
    <span class="shm-watch-item-icon" aria-hidden="true">
      <SvgIcon :name="icon.name" :set="icon.set" />
    </span>
    <span class="shm-watch-item-text">
      <span class="shm-watch-item-name">{{ entry.item.name }}</span>
      <span v-if="note" class="shm-watch-item-note">{{ note }}</span>
    </span>
    <span class="shm-watch-item-figures">
      <span v-if="(entry.item.count ?? 1) > 1" class="shm-watch-item-count">
        ×{{ entry.item.count }}
      </span>
      <span v-if="value" class="shm-value">{{ value }}</span>
    </span>
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

<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import SelectMenu from '@/shared/components/SelectMenu.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed, ref } from 'vue';
import {
  addToWatchlist,
  createWatchlistWith,
  removeFromWatchlist,
  saveErrorOf,
  watchlists,
  watchlistsByItem,
  type NewWatchItem,
} from '../use-watchlists';
import { itemKey, WATCHLIST_LIMITS } from '../watchlists';
import '../watchlists.css';

/*
 * The watchlists of an expanded item of My Hangar or the Buy Back (#468): each with a button to
 * take the item off it, a choice of the other watchlists to put it on, and a field that creates a
 * new watchlist with the item on it.
 */

const props = defineProps<{ item: NewWatchItem }>();
/** `choice`: what chooses the item, before the actions, e.g. a CCU's base ship (#470). */
defineSlots<{ choice?(): unknown }>();

const key = computed(() => itemKey(props.item));
const on = computed(() => watchlistsByItem.value.get(key.value) ?? []);
const others = computed(() => watchlists.value.filter((list) => !on.value.includes(list)));
/** The choice starts with its prompt, so every watchlist is a choice that adds. */
const PROMPT = '';
const options = computed(() => [
  { value: PROMPT, label: i18n.t('watchlists.addTo') },
  ...others.value.map((list) => ({ value: list.id, label: list.name })),
]);

const error = ref<string>();
const busy = ref(false);
async function run(action: () => Promise<unknown>) {
  error.value = undefined;
  busy.value = true;
  try {
    await action();
  } catch (cause) {
    error.value = saveErrorOf(cause);
  } finally {
    busy.value = false;
  }
}

const add = (id: string) => id !== PROMPT && run(() => addToWatchlist(id, props.item));
const remove = (id: string) => run(() => removeFromWatchlist(id, key.value));

const name = ref('');
async function create() {
  if (!name.value.trim() || busy.value) return;
  await run(() => createWatchlistWith(name.value, props.item));
  if (!error.value) name.value = '';
}
</script>

<template>
  <div class="shm-watchlist-picker" role="group" :aria-label="i18n.t('tabs.watchlists')">
    <span class="shm-watchlist-picker-label">
      <SvgIcon name="clipboard-list" />
      {{ i18n.t('tabs.watchlists') }}
    </span>
    <ul v-if="on.length" class="shm-watchlist-chips">
      <li v-for="list in on" :key="list.id" class="shm-watchlist-chip">
        <span class="shm-watchlist-chip-name">{{ list.name }}</span>
        <button
          v-tooltip="i18n.t('watchlists.removeFrom', [list.name])"
          type="button"
          class="shm-watchlist-chip-remove"
          :aria-label="i18n.t('watchlists.removeFrom', [list.name])"
          :disabled="busy"
          @click="remove(list.id)"
        >
          <SvgIcon name="xmark" />
        </button>
      </li>
    </ul>
    <span v-else class="shm-hint">{{ i18n.t('watchlists.notOnAny') }}</span>
    <div class="shm-watchlist-picker-actions">
      <slot name="choice" />
      <SelectMenu
        v-if="others.length"
        :options="options"
        :model-value="PROMPT"
        :label="i18n.t('watchlists.addTo')"
        icon="plus"
        align="start"
        button-class="shm-button"
        @update:model-value="add"
      />
      <form class="shm-watchlist-new" @submit.prevent="create">
        <input
          v-model="name"
          class="shm-watchlist-input"
          type="text"
          :maxlength="WATCHLIST_LIMITS.name"
          :placeholder="i18n.t('watchlists.newPlaceholder')"
          :aria-label="i18n.t('watchlists.newPlaceholder')"
          autocomplete="off"
          data-1p-ignore
        />
        <button type="submit" class="shm-button" :disabled="!name.trim() || busy">
          {{ i18n.t('watchlists.create') }}
        </button>
      </form>
    </div>
    <p v-if="error" class="shm-hint is-error" role="alert">{{ error }}</p>
  </div>
</template>

<style>
/* Its label and the line next to it ("On no watchlist yet.", the chips) on one baseline (#632). */
.shm-watchlist-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 10px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.15);
}

.shm-watchlist-picker > .shm-hint {
  margin: 0;
}

.shm-watchlist-picker-label {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: var(--shm-text);
}

/* Centered on the text, out of the baseline: the label's baseline is its text's. */
.shm-watchlist-picker-label .shm-icon {
  align-self: center;
  color: var(--shm-accent);
}

/* RSI's `#billing .content ul` resets lists; the chips set their own layout. */
.shm-watchlist-picker .shm-watchlist-chips:not(#shm-none) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-watchlist-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding-left: 9px;
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
  background: rgb(var(--shm-accent-rgb) / 0.14);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.4);
  border-radius: var(--shm-radius-small);
}

/* "Modern Hangar": a capsule without a border, as its tokens. */
html .shm-theme-modern .shm-watchlist-chip {
  border: 0;
  border-radius: var(--shm-radius-pill);
}

.shm-watchlist-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shm-watchlist-chip-remove {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 22px;
  padding: 0;
  color: var(--shm-text-muted);
  background: none;
  border: 0;
  cursor: pointer;
}

/* A hit area of 44 × 44 px (Apple Human Interface Guidelines) around the small ×. */
.shm-watchlist-chip-remove::before {
  position: absolute;
  inset: -11px -10px;
  content: '';
}

.shm-watchlist-chip-remove:hover,
.shm-watchlist-chip-remove:focus-visible {
  color: var(--shm-danger);
  outline: none;
}

.shm-watchlist-picker-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.shm-watchlist-new {
  display: flex;
  flex: 1 1 220px;
  gap: 6px;
  max-width: 360px;
}

.shm-watchlist-new .shm-watchlist-input {
  flex: 1 1 auto;
  min-width: 0;
}

.shm-watchlist-picker .shm-button {
  min-height: 32px;
}

/* "Add to watchlist" is a button like "Create": the menu's text-only padding doesn't fit it. */
.shm-watchlist-picker .shm-select-menu-button.shm-button {
  padding: 4px 10px;
}

.shm-watchlist-picker .is-error {
  width: 100%;
  margin: 0;
  color: var(--shm-danger);
}
</style>

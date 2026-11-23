<script setup lang="ts">
// Shared, unscoped styles as plain imports: `<style src>` of the same file in several
// components breaks the build and the tests by the order they are compiled in.
import '@/hangar/components/row.css';
import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { Settings } from '@/settings/settings';
import { computed, ref, watch } from 'vue';
import {
  createWatchlist,
  removeItem,
  removeItems,
  setItemCount,
  updateWatchlist,
  withLastSeen,
  type PledgeLists,
  type Watchlist,
} from '../watchlists';
import {
  removeWatchlist,
  saveErrorOf,
  storeWatchlist as store,
  watchlistRequest,
  watchlists as lists,
  WATCHLISTS_TOP_ID,
  watchlistsLoaded as loaded,
} from '../use-watchlists';
import WatchlistDialog from './WatchlistDialog.vue';
import { useStoreChanges } from '../use-store-changes';
import WatchlistMeta from './WatchlistMeta.vue';
import WatchlistView from './WatchlistView.vue';

/*
 * The tab "Watchlists" (#466, #467), second to last before the settings: all watchlists (#464) with
 * their item counts, dates and reminders, and a new one to create. A watchlist opens in its own view
 * (`WatchlistView`), with a way back to all of them. The demo shows its own lists (#474).
 */

const props = defineProps<{
  demo: boolean;
  pledges: PledgeView[];
  buyback: BuybackView[];
  settings: Settings;
  /** When My Hangar and the Buy Back were last read (ms); none while they weren't. */
  hangarReadAt?: number;
  buybackReadAt?: number;
  active: boolean;
}>();

// Another set of watchlists in the demo mode, or out of it.
watch(
  () => props.demo,
  () => (openId.value = undefined),
);

/** The stored lists, to tell pledges gone from those not read yet (`presenceOf`). */
const pledgeLists = computed((): PledgeLists => ({
  ...(props.hangarReadAt !== undefined && {
    hangar: { pledges: props.pledges, updatedAt: props.hangarReadAt },
  }),
  ...(props.buybackReadAt !== undefined && {
    buyback: { pledges: props.buyback, updatedAt: props.buybackReadAt },
  }),
}));

/** The watchlist shown; all of them without. */
const openId = ref<string>();
const open = computed(() => lists.value.find((list) => list.id === openId.value));
// A link to a watchlist (its reminder, #469): it opens once it is read.
watch(
  [watchlistRequest, loaded],
  ([request, ready]) => {
    if (!request || !ready) return;
    if (lists.value.some((list) => list.id === request.id)) openId.value = request.id;
    watchlistRequest.value = undefined;
  },
  { immediate: true },
);
// A watchlist deleted on another device goes back to all of them.
watch(open, (list) => {
  if (!list && loaded.value) openId.value = undefined;
});

/*
 * Seeing a watchlist notes its Pledge Store items as they are now (#472): the notifications of
 * their changes go.
 */
const storeChanges = useStoreChanges();
watch(
  [open, () => props.active, storeChanges.changed],
  ([list, active]) => {
    if (list && active) storeChanges.acknowledge(list);
  },
  { immediate: true },
);

/*
 * The names and values of its pledges as the lists show them now, so a pledge that leaves later
 * keeps them (`withLastSeen`). Only for the watchlist shown, and only when something changed.
 */
watch(
  [open, pledgeLists],
  ([list, known]) => {
    if (!list) return;
    const fresh = withLastSeen(list, known);
    if (fresh !== list) void store(fresh).catch(() => undefined);
  },
  { immediate: true },
);

// ---- Creating, editing, deleting ----

const dialog = ref<{ list?: Watchlist } | null>(null);
const error = ref<string>();
const busy = ref(false);
function openDialog(list?: Watchlist) {
  error.value = undefined;
  dialog.value = list ? { list } : {};
}

async function save(fields: {
  name: string;
  description: string;
  dueAt: number | null;
  reminder: boolean;
  storeAlerts: boolean;
}) {
  const now = Date.now();
  const editing = dialog.value?.list;
  const list = editing
    ? updateWatchlist(editing, fields, now)
    : createWatchlist({ ...fields, dueAt: fields.dueAt ?? undefined }, now);
  busy.value = true;
  error.value = undefined;
  try {
    await store(list);
    dialog.value = null;
    // A new watchlist opens, to fill it.
    if (!editing) openId.value = list.id;
  } catch (cause) {
    error.value = saveErrorOf(cause);
  } finally {
    busy.value = false;
  }
}

async function remove(list: Watchlist) {
  await removeWatchlist(list.id);
  openId.value = undefined;
}

function setCount(list: Watchlist, key: string, count: number) {
  const next = setItemCount(list, key, count, Date.now());
  if (next !== list) void store(next);
}

/** The selected items off this watchlist in one write (#620); a failed write keeps them all. */
function removeEntries(list: Watchlist, keys: string[]) {
  const next = removeItems(list, keys, Date.now());
  if (next !== list) void store(next);
}

function removeEntry(list: Watchlist, key: string) {
  const next = removeItem(list, key, Date.now());
  if (next !== list) void store(next);
}
</script>

<template>
  <div :id="WATCHLISTS_TOP_ID" class="shm-watchlists-top">
    <WatchlistView
      v-if="open"
      :key="open.id"
      :list="open"
      :pledges="pledges"
      :buyback="buyback"
      :settings="settings"
      :lists="pledgeLists"
      :active="active"
      @back="openId = undefined"
      @edit="openDialog(open)"
      @delete="remove(open)"
      @remove="removeEntry(open, $event)"
      @remove-many="removeEntries(open!, $event)"
      @count="(key, count) => setCount(open!, key, count)"
    />
    <section v-else class="shm-watchlists" aria-labelledby="shm-watchlists-title">
      <header class="shm-watchlists-header">
        <h3 id="shm-watchlists-title" class="shm-store-title shm-watchlists-title">
          <SvgIcon name="clipboard-list" />
          {{ i18n.t('tabs.watchlists') }}
        </h3>
        <button type="button" class="shm-button shm-watchlists-new" @click="openDialog()">
          <SvgIcon name="plus" />
          {{ i18n.t('watchlists.new') }}
        </button>
      </header>
      <!-- A secondary text as the other tabs' intros (#561): `.shm-store-intro` of StoreTab.vue. -->
      <p class="shm-store-intro">{{ i18n.t('watchlists.intro') }}</p>
      <ul v-if="lists.length" class="shm-rows shm-watchlists-list">
        <li v-for="list in lists" :key="list.id" class="shm-row shm-watchlists-row">
          <button type="button" class="shm-watchlists-open" @click="openId = list.id">
            <span class="shm-watchlists-text">
              <span class="shm-watchlists-name">{{ list.name }}</span>
              <WatchlistMeta :list="list" />
              <span v-if="list.description" class="shm-watchlists-description">
                {{ list.description }}
              </span>
            </span>
            <SvgIcon class="shm-watchlists-chevron" name="chevron-right" />
          </button>
        </li>
      </ul>
      <p v-else-if="loaded" class="shm-watchlists-empty">{{ i18n.t('watchlists.empty') }}</p>
    </section>
  </div>

  <WatchlistDialog
    v-if="dialog"
    :list="dialog.list"
    :error="error"
    :busy="busy"
    @save="save"
    @close="dialog = null"
  />
</template>

<style>
/* Below RSI's fixed top bar when scrolled to from a link. */
.shm-watchlists-top {
  scroll-margin-top: 90px;
}

.shm-watchlists {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.shm-watchlists-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
}

.shm-watchlists-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
 * Heavier than RSI's `#billing .content h3`, which adds a line under every h3 (an ID by
 * `:not(#shm-none)`, two classes).
 */
.shm-watchlists-header .shm-watchlists-title:not(#shm-none) {
  margin: 0;
  padding: 0;
  border: 0;
}

.shm-watchlists-title .shm-icon {
  color: var(--shm-accent);
}

.shm-watchlists-new.shm-button {
  min-height: 32px;
  padding: 6px 12px;
}

.shm-watchlists-empty {
  margin: 0;
  color: var(--shm-text-muted);
}

.shm-watchlists-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-row.shm-watchlists-row {
  content-visibility: visible;
}

/* The whole row opens the watchlist, as a disclosure row in a list. */
.shm-watchlists-open {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  color: inherit;
  font: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-watchlists-open:hover .shm-watchlists-name,
.shm-watchlists-open:focus-visible .shm-watchlists-name {
  color: var(--shm-text-strong);
}

.shm-watchlists-open:focus-visible {
  outline: 2px solid var(--shm-accent);
  outline-offset: -2px;
}

.shm-watchlists-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.shm-watchlists-name {
  overflow: hidden;
  color: var(--shm-text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shm-watchlists-description {
  overflow: hidden;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shm-watchlists-chevron {
  flex: none;
  color: var(--shm-text-muted);
}
</style>

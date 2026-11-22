<script setup lang="ts">
// Shared, unscoped styles as plain imports: `<style src>` of the same file in several
// components breaks the build and the tests by the order they are compiled in.
import '@/shared/overlay.css';
import '@/hangar/components/row.css';
import '../watchlists.css';
import '../selection-dialog.css';
import type { PledgeView } from '@/hangar/pledge-view';
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, nextTick, onUnmounted, ref, useId, useTemplateRef, watch } from 'vue';
import {
  addItemsToWatchlist,
  createWatchlistWithItems,
  saveErrorOf,
  watchlists,
  type NewWatchItem,
} from '../use-watchlists';
import { WATCHLIST_LIMITS, type Watchlist } from '../watchlists';
import WatchlistMeta from './WatchlistMeta.vue';

/*
 * The selection of My Hangar on a watchlist (#549), from the sidebar's "Selected" box: its button
 * opens a dialog with every watchlist to put all selected pledges on, and a field for a new one –
 * the sidebar is too narrow for a menu of them. Pledges already on it stay there once; the box then
 * tells how many were added. The demo's own watchlists in the demo (#474).
 */

const props = defineProps<{ pledges: readonly PledgeView[] }>();

const { settings } = useSettings();
const id = useId();

const items = computed((): NewWatchItem[] =>
  props.pledges.map((pledge) => ({
    kind: 'hangar',
    pledgeId: pledge.id,
    name: pledge.title,
    value: pledge.valueUsd,
  })),
);
const label = computed(() =>
  i18n.n('watchlists.selectionAdd', items.value.length, [items.value.length]),
);

const open = ref(false);
const busy = ref(false);
const error = ref<string>();
const done = ref<string>();
// Another selection: what was said of the last one no longer fits.
watch(
  () => props.pledges.map((pledge) => pledge.id).join(),
  () => (done.value = undefined),
);

/** Runs the write; the dialog closes once it worked, and the box says what happened. */
async function run(action: () => Promise<string>) {
  busy.value = true;
  error.value = undefined;
  try {
    done.value = await action();
    open.value = false;
  } catch (cause) {
    error.value = saveErrorOf(cause);
  } finally {
    busy.value = false;
  }
}

function add(list: Watchlist) {
  if (busy.value) return;
  void run(async () => {
    const added = await addItemsToWatchlist(list.id, items.value);
    return added
      ? i18n.n('watchlists.selectionAdded', added, [added, list.name])
      : i18n.t('watchlists.selectionAlready', [list.name]);
  });
}

const name = ref('');
async function create() {
  const title = name.value.trim();
  if (!title || busy.value) return;
  await run(async () => {
    const list = await createWatchlistWithItems(title, items.value);
    return i18n.n('watchlists.selectionAdded', items.value.length, [items.value.length, list.name]);
  });
  if (!error.value) name.value = '';
}

const dialog = useTemplateRef<HTMLElement>('dialog');
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !busy.value) open.value = false;
}
watch(open, async (shown) => {
  if (!shown) return removeEventListener('keydown', onKeydown);
  error.value = undefined;
  done.value = undefined;
  addEventListener('keydown', onKeydown);
  await nextTick();
  dialog.value?.focus();
});
onUnmounted(() => removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="shm-selection-watchlists">
    <button
      type="button"
      class="shm-button shm-sidebar-button is-full"
      aria-haspopup="dialog"
      @click="open = true"
    >
      <SvgIcon name="clipboard-list" />
      {{ label }}
    </button>
    <p v-if="done" class="shm-sidebar-note" role="status">{{ done }}</p>

    <Teleport v-if="open" to="body">
      <div
        class="shm-overlay"
        :class="themeClasses(settings)"
        :style="fontScaleStyle(settings)"
        @click.self="!busy && (open = false)"
      >
        <section
          ref="dialog"
          class="shm-overlay-dialog shm-selection-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`${id}-title`"
          tabindex="-1"
        >
          <header class="shm-overlay-header">
            <h3 :id="`${id}-title`">{{ label }}</h3>
            <button
              v-tooltip="i18n.t('order.close')"
              type="button"
              class="shm-overlay-close"
              :aria-label="i18n.t('order.close')"
              @click="open = false"
            >
              ×
            </button>
          </header>
          <ul v-if="watchlists.length" class="shm-selection-dialog-lists">
            <li v-for="list in watchlists" :key="list.id">
              <button
                type="button"
                class="shm-selection-dialog-list"
                :disabled="busy"
                @click="add(list)"
              >
                <span class="shm-selection-dialog-text">
                  <span class="shm-selection-dialog-name">{{ list.name }}</span>
                  <WatchlistMeta :list="list" />
                </span>
                <SvgIcon class="shm-selection-dialog-plus" name="plus" />
              </button>
            </li>
          </ul>
          <form class="shm-selection-dialog-new" @submit.prevent="create">
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
            <button type="submit" class="shm-button is-prominent" :disabled="!name.trim() || busy">
              {{ i18n.t('watchlists.create') }}
            </button>
          </form>
          <p v-if="error" class="shm-overlay-note is-error" role="alert">{{ error }}</p>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style>
.shm-selection-watchlists {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.shm-selection-watchlists .shm-sidebar-note {
  margin: 0;
}
</style>

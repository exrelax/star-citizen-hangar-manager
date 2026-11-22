<script setup lang="ts">
// Shared, unscoped styles as plain imports: `<style src>` of the same file in several
// components breaks the build and the tests by the order they are compiled in.
import '@/shared/overlay.css';
import '@/hangar/components/row.css';
import '@/shared/styles/switch.css';
import '@/watchlists/watchlists.css';
import '@/watchlists/selection-dialog.css';
import { useDemoContext } from '@/demo/use-demo';
import { localized } from '@/events/events';
import { EVENTS_VERSION, eventsItem } from '@/events/events-storage';
import { formatUsd } from '@/hangar/discount-format';
import { setMeltMarks } from '@/hangar/melt-marks';
import { useMarkedPledges } from '@/hangar/use-melt-marks';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { useNow } from '@/shared/use-now';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useStored } from '@/storage/use-stored';
import { runningEvent } from '@/store/warbond-history-view';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import WatchlistDialog from '@/watchlists/components/WatchlistDialog.vue';
import WatchlistMeta from '@/watchlists/components/WatchlistMeta.vue';
import {
  addItemCountsToWatchlist,
  createWatchlistWithItems,
  saveErrorOf,
  watchlists,
} from '@/watchlists/use-watchlists';
import type { Watchlist } from '@/watchlists/watchlists';
import { computed, nextTick, onUnmounted, ref, useId, useTemplateRef, watch } from 'vue';
import { rebuyWatchPlan } from '../rebuy-watchlist';
import { useProvidedRebuyables } from '../use-rebuyables';

/*
 * "Put on a watchlist to rebuy" (#531) for some pledges of My Hangar – the selection of the
 * "Selected" box, the List Shortcut "Melt and rebuy" (#530): each rebuyable pledge (#528) goes on a
 * watchlist as the store item it is rebought as, several of one item as its count; the others stay
 * off, counted. The dialog offers every watchlist and a new one ("Rebuy after <event or date>",
 * with the event's end as its date and a reminder, #469), and marks the pledges to melt (#97) if
 * wanted. Nothing is melted or bought. The demo's own watchlists and marks in the demo (#474).
 *
 * Hidden while not one of the pledges can be rebought. `buttonClass` styles its button for the
 * host, e.g. `shm-sidebar-button is-full` in the sidebar.
 */

const props = withDefaults(
  defineProps<{
    /** The pledges to put on the watchlist, by id; only the rebuyable ones go on it. */
    pledgeIds: readonly number[];
    /** Classes of its button besides `shm-button`. */
    buttonClass?: string;
  }>(),
  { buttonClass: 'shm-sidebar-button is-full' },
);
const emit = defineEmits<{
  /** After the watchlist was written: its id, and the text the host shows (also shown here). */
  done: [result: { watchlistId: string; text: string }];
}>();

const { settings } = useSettings();
const demo = useDemoContext();
const id = useId();
const rebuys = useProvidedRebuyables();
const marked = useMarkedPledges();
const now = useNow();

const plan = computed(() =>
  rebuyWatchPlan(props.pledgeIds, rebuys.value, (from, to) =>
    i18n.t('watchlists.ccuName', [from, to]),
  ),
);
const count = computed(() => plan.value?.pledgeIds.length ?? 0);
const label = computed(() => i18n.n('watchlists.rebuy.button', count.value, [count.value]));
const usd = (value: number) => formatUsd(value, locale.value);
/** The rebuyable pledges not marked to melt yet. */
const unmarked = computed(
  () => plan.value?.pledgeIds.filter((pledgeId) => !marked.value.has(pledgeId)) ?? [],
);

/** Marks them to melt too (#97), on by default: they are put on it to be melted. */
const markToo = ref(true);

/*
 * The name of a new one: after the event running now (the demo's own events in the demo, unless it
 * shows the real Pledge Store data, #310), with its end as the date; else after today.
 */
const storedEvents = useStored(eventsItem);
const events = computed(() =>
  demo.value && !settings.value.demo.realStoreData
    ? demo.value.events
    : storedEvents.value?.version === EVENTS_VERSION
      ? storedEvents.value.events
      : [],
);
const initial = computed(() => {
  const event = runningEvent(events.value, now.value);
  if (event) {
    return {
      name: i18n.t('watchlists.rebuy.name', [localized(event.name, locale.value)]),
      dueAt: event.eventEnd,
    };
  }
  const date = new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(now.value);
  return { name: i18n.t('watchlists.rebuy.name', [date]) };
});

const stage = ref<'closed' | 'choose' | 'new'>('closed');
const busy = ref(false);
const error = ref<string>();
const done = ref<string>();
// Other pledges: what was said of the last ones no longer fits.
watch(
  () => props.pledgeIds.join(),
  () => (done.value = undefined),
);

/** What the action did: items added or counted up, pledges marked and skipped. */
async function finish(list: Watchlist, added: number, raised: number) {
  const current = plan.value!;
  const parts = [
    raised
      ? i18n.n('watchlists.rebuy.addedRaised', current.items.length, [
          current.items.length,
          list.name,
          raised,
        ])
      : i18n.n('watchlists.rebuy.added', added, [added, list.name]),
  ];
  if (markToo.value && unmarked.value.length) {
    const ids = unmarked.value;
    await setMeltMarks(ids, true, !!demo.value);
    parts.push(i18n.n('meltMark.selectionMarked', ids.length, [ids.length]));
  }
  if (current.skipped) {
    parts.push(i18n.n('watchlists.rebuy.skipped', current.skipped, [current.skipped]));
  }
  const text = parts.join(' ');
  done.value = text;
  stage.value = 'closed';
  emit('done', { watchlistId: list.id, text });
}

async function run(write: () => Promise<void>) {
  if (busy.value || !plan.value) return;
  busy.value = true;
  error.value = undefined;
  try {
    await write();
  } catch (cause) {
    error.value = saveErrorOf(cause);
  } finally {
    busy.value = false;
  }
}

function add(list: Watchlist) {
  void run(async () => {
    const { added, raised } = await addItemCountsToWatchlist(list.id, plan.value!.items);
    await finish(list, added, raised);
  });
}

function create(fields: {
  name: string;
  description: string;
  dueAt: number | null;
  reminder: boolean;
  storeAlerts: boolean;
}) {
  void run(async () => {
    const items = plan.value!.items;
    const list = await createWatchlistWithItems(fields.name, items, {
      description: fields.description,
      ...(fields.dueAt !== null && { dueAt: fields.dueAt }),
      reminder: fields.reminder,
      storeAlerts: fields.storeAlerts,
    });
    await finish(list, items.length, 0);
  });
}

function openNew() {
  error.value = undefined;
  stage.value = 'new';
}
/** The new watchlist's dialog goes back to the choice. */
function closeNew() {
  if (busy.value) return;
  error.value = undefined;
  stage.value = 'choose';
}

const dialog = useTemplateRef<HTMLElement>('dialog');
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !busy.value && stage.value === 'choose') stage.value = 'closed';
}
watch(stage, async (shown, before) => {
  if (shown !== 'choose') return removeEventListener('keydown', onKeydown);
  if (before === 'closed') {
    error.value = undefined;
    done.value = undefined;
  }
  addEventListener('keydown', onKeydown);
  await nextTick();
  dialog.value?.focus();
});
onUnmounted(() => removeEventListener('keydown', onKeydown));
</script>

<template>
  <div v-if="plan" class="shm-rebuy-watchlist">
    <button
      v-tooltip="i18n.t('watchlists.rebuy.buttonHint')"
      type="button"
      class="shm-button"
      :class="buttonClass"
      aria-haspopup="dialog"
      @click="stage = 'choose'"
    >
      <SvgIcon name="clipboard-list" />
      {{ label }}
    </button>
    <p v-if="done" class="shm-sidebar-note" role="status">{{ done }}</p>

    <Teleport v-if="stage === 'choose'" to="body">
      <div
        class="shm-overlay"
        :class="[themeClasses(settings), { 'shm-hide-values': settings.hideMeltValue }]"
        :style="fontScaleStyle(settings)"
        @click.self="!busy && (stage = 'closed')"
      >
        <section
          ref="dialog"
          class="shm-overlay-dialog shm-selection-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`${id}-title`"
          :aria-describedby="`${id}-summary`"
          tabindex="-1"
        >
          <header class="shm-overlay-header">
            <h3 :id="`${id}-title`">{{ label }}</h3>
            <button
              v-tooltip="i18n.t('order.close')"
              type="button"
              class="shm-overlay-close"
              :aria-label="i18n.t('order.close')"
              @click="stage = 'closed'"
            >
              ×
            </button>
          </header>
          <div :id="`${id}-summary`" class="shm-rebuy-watchlist-summary">
            <p class="shm-overlay-note">
              {{ i18n.n('watchlists.rebuy.items', plan.items.length, [plan.items.length]) }}
            </p>
            <dl class="shm-rebuy-watchlist-sums">
              <div>
                <dt>{{ i18n.t('watchlists.rebuy.cost') }}</dt>
                <dd class="shm-value">{{ usd(plan.total) }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('watchlists.rebuy.freed') }}</dt>
                <dd class="shm-value">{{ usd(plan.freedCredit) }}</dd>
              </div>
            </dl>
            <p v-if="plan.skipped" class="shm-overlay-note">
              {{ i18n.n('watchlists.rebuy.skipped', plan.skipped, [plan.skipped]) }}
            </p>
          </div>
          <div v-if="unmarked.length" class="shm-watchlist-form">
            <label class="shm-watchlist-reminder">
              <span class="shm-watchlist-reminder-text">
                <span>{{
                  i18n.n('watchlists.rebuy.mark', unmarked.length, [unmarked.length])
                }}</span>
                <span class="shm-hint">{{ i18n.t('watchlists.rebuy.markHint') }}</span>
              </span>
              <input v-model="markToo" type="checkbox" role="switch" class="shm-switch" />
            </label>
          </div>
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
          <button
            type="button"
            class="shm-button is-prominent shm-rebuy-watchlist-new"
            :disabled="busy"
            @click="openNew"
          >
            <SvgIcon name="plus" />
            {{ i18n.t('watchlists.new') }}
          </button>
          <p v-if="error" class="shm-overlay-note is-error" role="alert">{{ error }}</p>
        </section>
      </div>
    </Teleport>
    <WatchlistDialog
      v-if="stage === 'new'"
      :initial="initial"
      :error="error"
      :busy="busy"
      @save="create"
      @close="closeNew"
    />
  </div>
</template>

<style>
.shm-rebuy-watchlist {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.shm-rebuy-watchlist .shm-sidebar-note {
  margin: 0;
}

.shm-rebuy-watchlist-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shm-rebuy-watchlist-summary .shm-overlay-note {
  margin: 0;
}

.shm-rebuy-watchlist-sums {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 0;
}

.shm-rebuy-watchlist-sums > div {
  display: flex;
  gap: 8px;
}

.shm-rebuy-watchlist-sums dt {
  color: var(--shm-text-secondary);
}

.shm-rebuy-watchlist-sums dd {
  margin: 0;
  color: var(--shm-text);
  font-variant-numeric: tabular-nums;
}

.shm-rebuy-watchlist-new.shm-button {
  align-self: flex-start;
  min-height: 32px;
  padding: 6px 14px;
}
</style>

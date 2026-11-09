<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { Settings } from '@/settings/settings';
import { useSettings } from '@/settings/use-settings';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import type { PledgeView } from '../pledge-view';
import { selection, visiblePledgeIds } from '../selection';
import { moveBox, placeAt, type SidebarBox as Box } from '../sidebar';
import { summarize, type PledgeSummary } from '../summary';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useDemoContext } from '@/demo/use-demo';
import SidebarBox from './SidebarBox.vue';
import { openTabAt } from '../open-tab-at';
import { BULK_MELTING_SETTING_ID } from '@/settings/anchors';
import BulkExchangeOverlay from './BulkExchangeOverlay.vue';
import { checkOff, type AppNotification } from '@/notifications/notifications';
import { useOpenNotifications } from '@/notifications/use-notifications';
import { meltReadyIds, useMarkedPledges } from '../use-melt-marks';
import { clearHangarFilter, hangarViewFilter, showHangarFilter } from '../view-filter';
import { formatTimeLeft } from '../melt-marks';
import { myGearHref } from '../route';
import { useNow } from '@/shared/use-now';
import { vMarkWrapped } from '@/shared/mark-wrapped';
import {
  maybePaintConsultant,
  openPaintConsultant,
} from '@/store/paint-consultant/use-paint-consultant';
import {
  demoDismissedPaintsItem,
  dismissedOf,
  dismissedPaintsItem,
  isPaintNotificationShown,
} from '@/store/paint-consultant/paint-notification';
import { useStored } from '@/storage/use-stored';

/*
 * The sidebar below RSI's page navigation on the left on every tab (App.vue teleports it there),
 * a column of boxes: the notifications, the summary of the hangar's visible pledges (value,
 * discounts, number) and – with a selection – the same of the selected ones. The boxes can be
 * moved up and down by their title, with the mouse or the arrow keys, and collapsed to their title;
 * the order and the collapsed boxes are kept in the settings (see `sidebar.ts`).
 */

const props = defineProps<{ pledges: readonly PledgeView[]; settings: Settings }>();
const { update } = useSettings();

const visible = computed(() => {
  const ids = visiblePledgeIds.value;
  return ids ? props.pledges.filter((pledge) => ids.has(pledge.id)) : props.pledges;
});
const selected = computed(() => {
  const ids = selection.ids.value;
  return ids.size ? props.pledges.filter((pledge) => ids.has(pledge.id)) : [];
});
/** Selected pledges that search or filters hide. */
const hiddenSelected = computed(() => {
  const ids = visiblePledgeIds.value;
  return ids ? selected.value.filter((pledge) => !ids.has(pledge.id)).length : 0;
});

const shown = computed(() => summarize(visible.value));

// Bulk melting (an experimental setting): the selected pledges that can be exchanged.
const meltable = computed(() => selected.value.filter((pledge) => pledge.isMeltable));
const bulkExchanging = ref(false);
/** Bulk melting is off: the settings tab, at its setting. */
const openBulkMeltingSetting = () =>
  openTabAt('settings', BULK_MELTING_SETTING_ID, { highlight: true });
const chosen = computed(() => (selected.value.length ? summarize(selected.value) : undefined));

// The demo mode: its pledge ids are made up, so nothing links to RSI or melts.
const demo = useDemoContext();

const money = computed(
  () => new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD' }),
);
const number = computed(() => new Intl.NumberFormat(locale.value));
const types = (summary: PledgeSummary) =>
  summary.types
    .map(({ type, count }) => `${number.value.format(count)} ${i18n.t(`filter.${type}`)}`)
    .join(' · ');

// ---- Notifications (#142) ----

const notes = useOpenNotifications();
const marked = useMarkedPledges();
const now = useNow();
const titleOf = computed(() => new Map(props.pledges.map((pledge) => [pledge.id, pledge.title])));
/** Marked pledges of the hangar that can't be melted yet, the soonest first. */
const pending = computed(() =>
  [...marked.value.values()]
    .filter((mark) => mark.meltableAt > now.value && titleOf.value.has(mark.pledgeId))
    .sort((a, b) => a.meltableAt - b.meltableAt),
);
/**
 * Marked pledges that can be melted now: one notification for all of them, which stays while
 * there are any – it can't be checked off.
 */
const readyCount = computed(() => meltReadyIds.value.size);
/** All notifications: those about marked pledges and paints to buy again, and the stored ones. */
const noteCount = computed(
  () => notes.value.length + (readyCount.value ? 1 : 0) + (paintNoteCount.value ? 1 : 0),
);
const noteTime = computed(
  () => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }),
);
/** The pledge in RSI's "My Gear", if it is still in the hangar; not in the demo. */
function noteHref(note: AppNotification) {
  if (demo.value || note.pledgeId === undefined) return undefined;
  const pledge = props.pledges.find((candidate) => candidate.id === note.pledgeId);
  return pledge && myGearHref(location.pathname, pledge.page, pledge.id);
}

/** Shows only the marked pledges that can be melted now in "My Hangar", and again all (#147). */
const readyFiltered = computed(() => hangarViewFilter.value?.id === 'meltReady');
function toggleReadyFilter() {
  if (readyFiltered.value) clearHangarFilter('meltReady');
  else showHangarFilter('meltReady');
}

/** The paints the consultant would buy again are filtered in "My Hangar" (#146). */
const rebuyFiltered = computed(() => hangarViewFilter.value?.id === 'paintRebuy');
function toggleRebuyFilter() {
  if (rebuyFiltered.value) clearHangarFilter('paintRebuy');
  else showHangarFilter('paintRebuy');
}

/** Selects them, so the "Selected" box offers to melt them all at once. */
function selectReady() {
  selection.replace(meltReadyIds.value);
}

const TITLES = {
  notifications: 'notifications.title',
  summary: 'summary.title',
  selection: 'summary.selected',
  paintConsultant: 'consultant.boxTitle',
} as const;

// The Paint Discount Consultant at first glance (worked out once in App.vue).
const consultant = maybePaintConsultant();
/** The consultant's plan, only with at least one paint to buy again: the box shows only then. */
const rebuyPlan = computed(() => {
  const plan = consultant?.result.value?.plan;
  return plan?.own.length ? plan : undefined;
});

/*
 * The consultant's notification (#151): how many paints can be bought again with more discount,
 * until it is dismissed for exactly these paints (see `paint-notification.ts`). Not with "Hide
 * melt value" on, like the box.
 */
const realDismissed = useStored(dismissedPaintsItem);
const demoDismissed = useStored(demoDismissedPaintsItem);
const dismissedItem = () => (demo.value ? demoDismissedPaintsItem : dismissedPaintsItem);
const rebuyIds = computed(() =>
  props.settings.hideMeltValue ? [] : (rebuyPlan.value?.own.map((paint) => paint.pledgeId) ?? []),
);
/** The paints the notification counts, or 0 while it isn't shown. */
const paintNoteCount = computed(() => {
  const dismissed = demo.value ? demoDismissed.value : realDismissed.value;
  // Not before the dismissed paints are read: it would show for a moment.
  if (!dismissed || !isPaintNotificationShown(rebuyIds.value, dismissed)) return 0;
  return rebuyIds.value.length;
});
function dismissPaintNote() {
  void dismissedItem().setValue(dismissedOf(rebuyIds.value));
}

// ---- Order and collapsed boxes ----

/**
 * A setting changed here until the settings have it: they are passed in from the manager and
 * change only once the stored settings did, so the boxes would jump back in between.
 */
function usePending(source: () => Box[]) {
  const pending = ref<Box[]>();
  watch(source, () => (pending.value = undefined));
  return {
    value: computed(() => pending.value ?? source()),
    set: (value: Box[]) => (pending.value = value),
  };
}

const savedOrder = usePending(() => props.settings.sidebarOrder);
const savedCollapsed = usePending(() => props.settings.sidebarCollapsed);
const current = savedOrder.value;

/** While dragging: the order the boxes would get when dropped there. */
const preview = ref<Box[]>();
const order = computed(() => preview.value ?? current.value);
const isShown = (box: Box) =>
  !props.settings.sidebarHidden.includes(box) &&
  (box === 'selection'
    ? !!chosen.value
    : box === 'notifications'
      ? noteCount.value > 0
      : box === 'paintConsultant'
        ? !props.settings.hideMeltValue && !!rebuyPlan.value
        : true);
const boxes = computed(() => order.value.filter(isShown));

const isCollapsed = (box: Box) => savedCollapsed.value.value.includes(box);
function toggle(box: Box) {
  const collapsed = savedCollapsed.value.value;
  const next = isCollapsed(box) ? collapsed.filter((other) => other !== box) : [...collapsed, box];
  savedCollapsed.set(next);
  void update({ sidebarCollapsed: next });
}

function save(next: Box[]) {
  if (next.join() === current.value.join()) return false;
  // A plain array: the browser would store Vue's reactive one as an object.
  const plain = [...next];
  savedOrder.set(plain);
  void update({ sidebarOrder: plain });
  return true;
}

const root = useTemplateRef('root');
/** The place of a box in the sidebar; the box in it moves away from it while dragged or animated. */
const slotOf = (box: Box) => root.value?.querySelector<HTMLElement>(`[data-box="${box}"]`);
const boxOf = (box: Box) => slotOf(box)?.firstElementChild as HTMLElement | null | undefined;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lets a box glide from `offset` pixels above or below to its place. */
function glide(element: HTMLElement | null | undefined, offset: number) {
  if (!element || Math.abs(offset) < 1 || reducedMotion()) return;
  element.animate([{ transform: `translateY(${offset}px)` }, { transform: 'none' }], {
    duration: 200,
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
  });
}

// ---- Dragging ----

const dragged = ref<Box>();
/** Where the pointer is, and where in the dragged box it took hold of it. */
let pointerY = 0;
let holdY = 0;
/** How far the dragged box is moved away from its place. */
let offset = 0;
/** The pointer that holds the box; others (a second finger) don't move it. */
let pointerId: number | undefined;

/*
 * While dragging, the window follows the pointer: the boxes move in the page meanwhile, and an
 * element that is moved loses the pointer.
 */
function grab(box: Box, event: PointerEvent) {
  const element = boxOf(box);
  if (!element) return;
  dragged.value = box;
  preview.value = [...current.value];
  pointerId = event.pointerId;
  pointerY = event.clientY;
  holdY = event.clientY - element.getBoundingClientRect().top;
  offset = 0;
  addEventListener('pointermove', drag);
  addEventListener('pointerup', drop);
  addEventListener('pointercancel', drop);
}

/** Keeps the dragged box under the pointer, within the sidebar. */
function follow() {
  const box = dragged.value;
  const slot = box && slotOf(box);
  const element = box && boxOf(box);
  const sidebar = root.value?.getBoundingClientRect();
  if (!slot || !element || !sidebar) return;
  const top = Math.min(
    Math.max(pointerY - holdY, sidebar.top),
    sidebar.bottom - element.offsetHeight,
  );
  offset = top - slot.getBoundingClientRect().top;
  element.style.transform = `translateY(${offset}px)`;
}

/**
 * Moves the dragged box's place by the pointer (see `placeAt`). The others are measured as if the
 * dragged box weren't there, so the order doesn't flip back and forth when boxes have different
 * heights.
 */
async function drag(event: PointerEvent) {
  const box = dragged.value;
  const slot = box && slotOf(box);
  if (!box || !slot || !preview.value || !root.value || event.pointerId !== pointerId) return;
  pointerY = event.clientY;
  follow();

  const gap = parseFloat(getComputedStyle(root.value).rowGap) || 0;
  const shift = slot.offsetHeight + gap;
  const index = preview.value.indexOf(box);
  const others = boxes.value.filter((other) => other !== box);
  const middles = others.flatMap((other) => {
    const rect = slotOf(other)?.getBoundingClientRect();
    if (!rect) return [];
    const top = rect.top - (preview.value!.indexOf(other) > index ? shift : 0);
    return [{ box: other, middle: top + rect.height / 2 }];
  });
  const next = placeAt(preview.value, box, middles, pointerY);
  if (next.join() === preview.value.join()) return;

  // The other boxes glide to their new places (FLIP: measure, reorder, measure, animate).
  const before = new Map(others.map((other) => [other, boxOf(other)?.getBoundingClientRect().top]));
  preview.value = next;
  await nextTick();
  follow();
  for (const other of others) {
    const element = boxOf(other);
    const old = before.get(other);
    if (element && old !== undefined) glide(element, old - element.getBoundingClientRect().top);
  }
}

/** The dragged box glides into its place. */
function drop(event?: PointerEvent) {
  if (event && event.pointerId !== pointerId) return;
  removeEventListener('pointermove', drag);
  removeEventListener('pointerup', drop);
  removeEventListener('pointercancel', drop);
  const box = dragged.value;
  if (!box) return;
  const element = boxOf(box);
  if (element) {
    element.style.transform = '';
    glide(element, offset);
  }
  const next = preview.value;
  dragged.value = undefined;
  preview.value = undefined;
  if (next) save(next);
}

onUnmounted(() => drop());

/** For screen readers: where a box moved with the keyboard is now. */
const announcement = ref('');

async function move(box: Box, step: -1 | 1) {
  const others = boxes.value.filter((other) => other !== box);
  const before = new Map(
    boxes.value.map((other) => [other, boxOf(other)?.getBoundingClientRect().top]),
  );
  if (!save(moveBox(current.value, box, step, boxes.value))) return;
  await nextTick();
  for (const other of [box, ...others]) {
    const element = boxOf(other);
    const old = before.get(other);
    if (element && old !== undefined) glide(element, old - element.getBoundingClientRect().top);
  }
  // Moving the element in the page can take the focus away from its handle.
  boxOf(box)?.querySelector<HTMLElement>('.shm-sidebar-handle')?.focus();
  announcement.value = i18n.t('sidebar.moved', [boxes.value.indexOf(box) + 1, boxes.value.length]);
}
</script>

<template>
  <div
    v-if="boxes.length"
    ref="root"
    class="shm-sidebar"
    :class="[themeClasses(settings), { 'is-sorting': dragged }]"
    :style="fontScaleStyle(settings)"
    role="region"
    :aria-label="i18n.t('sidebar.label')"
  >
    <div v-for="box in boxes" :key="box" class="shm-sidebar-slot" :data-box="box">
      <SidebarBox
        :title="i18n.t(TITLES[box])"
        :badge="box === 'notifications' && noteCount ? number.format(noteCount) : undefined"
        :badge-label="
          box === 'notifications' && noteCount
            ? i18n.t(noteCount === 1 ? 'notifications.countOne' : 'notifications.count', [
                number.format(noteCount),
              ])
            : undefined
        "
        :dragging="box === dragged"
        :collapsed="isCollapsed(box)"
        @grab="(event) => grab(box, event)"
        @move="(step) => move(box, step)"
        @toggle="toggle(box)"
      >
        <template v-if="box === 'notifications'">
          <!-- Only shown with at least one notification (see `isShown`). -->
          <div v-if="readyCount" class="shm-sidebar-melt-ready" role="status">
            <SvgIcon name="recycle" />
            <p>
              {{
                i18n.t(
                  readyCount === 1 ? 'notifications.meltReadyOne' : 'notifications.meltReady',
                  [number.format(readyCount)],
                )
              }}
            </p>
            <div v-mark-wrapped class="shm-sidebar-actions">
              <button
                v-tooltip="
                  i18n.t(
                    readyFiltered ? 'notifications.showAllHint' : 'notifications.showReadyHint',
                  )
                "
                type="button"
                class="shm-button shm-sidebar-button"
                :aria-pressed="readyFiltered"
                @click="toggleReadyFilter"
              >
                <SvgIcon :name="readyFiltered ? 'filter-circle-xmark' : 'filter'" />
                {{ i18n.t(readyFiltered ? 'notifications.showAll' : 'notifications.showReady') }}
              </button>
              <button
                v-tooltip="i18n.t('notifications.selectReadyHint')"
                type="button"
                class="shm-button shm-sidebar-button"
                @click="selectReady"
              >
                <SvgIcon name="circle-check" />
                {{ i18n.t('notifications.selectReady') }}
              </button>
            </div>
          </div>
          <div v-if="paintNoteCount" class="shm-sidebar-melt-ready is-dismissable" role="status">
            <SvgIcon name="paintbrush" />
            <p>
              {{
                i18n.t(
                  paintNoteCount === 1
                    ? 'notifications.paintsRebuyOne'
                    : 'notifications.paintsRebuy',
                  [number.format(paintNoteCount)],
                )
              }}
            </p>
            <button
              v-tooltip="i18n.t('notifications.dismissPaintsHint')"
              type="button"
              class="shm-sidebar-icon-button shm-sidebar-note-dismiss"
              :aria-label="i18n.t('notifications.dismiss')"
              @click="dismissPaintNote"
            >
              <SvgIcon name="xmark" />
            </button>
          </div>
          <ul v-if="notes.length" class="shm-sidebar-notes">
            <li v-for="note in notes" :key="note.id">
              <input
                type="checkbox"
                class="shm-sidebar-note-check"
                :aria-label="`${i18n.t('notifications.checkOff')}: ${note.text}`"
                @change="checkOff([note.id])"
              />
              <span class="shm-sidebar-note-text">
                <a v-if="noteHref(note)" :href="noteHref(note)">{{ note.text }}</a>
                <template v-else>{{ note.text }}</template>
                <time class="shm-sidebar-note">{{ noteTime.format(note.at) }}</time>
              </span>
            </li>
          </ul>
          <button
            v-if="notes.length > 1"
            type="button"
            class="shm-sidebar-link"
            @click="checkOff()"
          >
            {{ i18n.t('notifications.checkOffAll') }}
          </button>
          <!-- What comes later: the marked pledges with the time left. -->
          <template v-if="pending.length">
            <p class="shm-sidebar-subtitle">{{ i18n.t('notifications.pending') }}</p>
            <ul class="shm-sidebar-pending">
              <li v-for="mark in pending" :key="mark.pledgeId">
                <span class="shm-sidebar-pending-title">{{ titleOf.get(mark.pledgeId) }}</span>
                <span class="shm-sidebar-note">
                  {{ i18n.t('meltMark.waiting', [formatTimeLeft(mark.meltableAt - now, locale)]) }}
                </span>
              </li>
            </ul>
          </template>
        </template>

        <template v-else-if="box === 'summary'">
          <dl class="shm-sidebar-figures">
            <div>
              <dt>{{ i18n.t('summary.count') }}</dt>
              <dd>{{ number.format(shown.count) }}</dd>
            </div>
            <template v-if="!settings.hideMeltValue">
              <div>
                <dt>{{ i18n.t('summary.value') }}</dt>
                <dd>{{ money.format(shown.value) }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('summary.discount') }}</dt>
                <dd class="is-discount">{{ money.format(shown.discount) }}</dd>
              </div>
            </template>
          </dl>
          <p v-if="settings.summaryTypes && shown.types.length" class="shm-sidebar-note">
            {{ types(shown) }}
          </p>
        </template>

        <template v-else-if="box === 'selection' && chosen">
          <dl class="shm-sidebar-figures">
            <div>
              <dt>{{ i18n.t('summary.count') }}</dt>
              <dd>{{ number.format(chosen.count) }}</dd>
            </div>
            <template v-if="!settings.hideMeltValue">
              <div>
                <dt>{{ i18n.t('summary.value') }}</dt>
                <dd>{{ money.format(chosen.value) }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('summary.discount') }}</dt>
                <dd class="is-discount">{{ money.format(chosen.discount) }}</dd>
              </div>
            </template>
          </dl>
          <!-- Always per type here; only the "Summary" box makes it a setting. -->
          <p v-if="chosen.types.length" class="shm-sidebar-note">
            {{ types(chosen) }}
          </p>
          <p v-if="hiddenSelected" class="shm-sidebar-note is-warning" role="status">
            {{ i18n.t('summary.hidden', [hiddenSelected]) }}
          </p>
          <div v-if="meltable.length" class="shm-sidebar-actions">
            <!-- Disabled in the demo: its pledge ids are made up. -->
            <button
              v-if="settings.bulkMelting"
              v-tooltip="demo ? i18n.t('exchange.demo') : i18n.t('bulkExchange.buttonHint')"
              type="button"
              class="shm-button is-danger shm-sidebar-button is-full"
              :disabled="!!demo"
              @click="bulkExchanging = true"
            >
              <SvgIcon name="triangle-exclamation" />
              {{ i18n.t('bulkExchange.button', [meltable.length]) }}
            </button>
            <!-- Off: points to the experimental setting, so the feature can be found (#159). -->
            <button
              v-else
              v-tooltip="i18n.t('bulkExchange.disabledHint')"
              type="button"
              class="shm-button shm-sidebar-button is-full"
              @click="openBulkMeltingSetting"
            >
              <SvgIcon name="gear" />
              {{ i18n.t('bulkExchange.disabled') }}
            </button>
          </div>
          <BulkExchangeOverlay
            v-if="bulkExchanging"
            :pledges="meltable"
            :hangar="pledges"
            :skipped="selected.length - meltable.length"
            @close="bulkExchanging = false"
          />
        </template>

        <!-- Only shown with at least one paint to buy again (see `isShown`). -->
        <template v-else-if="box === 'paintConsultant' && rebuyPlan">
          <dl class="shm-sidebar-figures">
            <div>
              <dt>{{ i18n.t('consultant.boxPaints') }}</dt>
              <dd>{{ number.format(rebuyPlan.own.length) }}</dd>
            </div>
            <div>
              <dt v-tooltip="i18n.t('consultant.freedHint')">
                {{ i18n.t('consultant.freed') }}
              </dt>
              <dd class="is-discount">{{ money.format(rebuyPlan.storeCreditFreed) }}</dd>
            </div>
          </dl>
          <div class="shm-sidebar-actions">
            <!-- Shows only these paints in My Hangar, and again all (#146). -->
            <button
              v-tooltip="
                i18n.t(rebuyFiltered ? 'consultant.boxUnfilterHint' : 'consultant.boxFilterHint')
              "
              type="button"
              class="shm-button shm-sidebar-button"
              :aria-pressed="rebuyFiltered"
              @click="toggleRebuyFilter"
            >
              <SvgIcon :name="rebuyFiltered ? 'filter-circle-xmark' : 'filter'" />
              {{ i18n.t(rebuyFiltered ? 'consultant.boxUnfilter' : 'consultant.boxFilter') }}
            </button>
            <button
              type="button"
              class="shm-button shm-sidebar-button"
              @click="openPaintConsultant"
            >
              <SvgIcon name="user-tie" />
              {{ i18n.t('consultant.boxOpen') }}
            </button>
          </div>
        </template>

        <template v-if="box === 'selection'" #actions>
          <button
            v-tooltip="i18n.t('summary.clear')"
            type="button"
            class="shm-sidebar-icon-button"
            :aria-label="i18n.t('summary.clear')"
            @click="selection.clear()"
          >
            <SvgIcon name="xmark" />
          </button>
        </template>
      </SidebarBox>
    </div>
    <p class="shm-sidebar-status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style>
/* A column of boxes; the gap between them is the same in both themes. */
.shm-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
  line-height: 1.4;
}

/*
 * Classic RSI: it ends where RSI's navigation items end (their background stops 21 px before the
 * column's edge), so it keeps a gap to the manager, which starts right after the column.
 */
.shm-sidebar.shm-theme-rsi {
  width: calc(100% - 21px);
}

/* Classic RSI: square, outlined like RSI's own boxes. "Modern Hangar": modern.css. */
.shm-sidebar-box {
  position: relative;
  box-sizing: border-box;
  padding: 12px 14px;
  background: rgb(var(--shm-surface-rgb) / 0.92);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.3);
}

/*
 * A count on the box's top right corner, reaching a little over its edge, like apps show unread
 * messages (e.g. the notifications); also while the box is collapsed.
 */
.shm-sidebar-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 1;
  box-sizing: border-box;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  color: #fff;
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  background: var(--shm-danger);
  border-radius: var(--shm-radius-pill);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
  pointer-events: none;
}

/* While a box is dragged, the places of the boxes show as the sidebar's grid. */
.shm-sidebar-slot {
  position: relative;
}

.shm-sidebar.is-sorting .shm-sidebar-slot {
  background: rgb(var(--shm-accent-rgb) / 0.06);
  outline: 1px dashed rgb(var(--shm-accent-rgb) / 0.45);
}

.shm-sidebar.is-sorting,
.shm-sidebar.is-sorting .shm-sidebar-handle {
  cursor: grabbing;
  user-select: none;
}

/* The dragged box follows the pointer above the others (its transform is set while dragging). */
.shm-sidebar-box.is-dragging {
  position: relative;
  z-index: 1;
  box-shadow: 0 12px 30px rgb(0 0 0 / 0.45);
}

.shm-sidebar-toggle .shm-icon {
  transition: transform 0.2s ease;
}

.shm-sidebar-box.is-collapsed .shm-sidebar-toggle .shm-icon {
  transform: rotate(180deg);
}

/* Collapsing animates the height: the body's only grid row shrinks from its content to nothing. */
.shm-sidebar-box-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.2s ease;
}

.shm-sidebar-box.is-collapsed .shm-sidebar-box-body {
  grid-template-rows: 0fr;
}

.shm-sidebar-box-content {
  min-height: 0;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .shm-sidebar-toggle .shm-icon,
  .shm-sidebar-box-body {
    transition: none;
  }
}

.shm-sidebar-box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.shm-sidebar-handle {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.shm-sidebar-handle:active {
  cursor: grabbing;
}

.shm-sidebar-handle .shm-icon {
  color: var(--shm-text-faint);
}

.shm-sidebar-handle:focus-visible {
  outline: 1px solid var(--shm-accent);
  outline-offset: 2px;
}

.shm-sidebar-title {
  color: var(--shm-accent);
  font-size: calc(11px * var(--shm-font-scale));
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-sidebar-icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--shm-text-muted);
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-sidebar-icon-button:hover,
.shm-sidebar-icon-button:focus-visible {
  color: var(--shm-text-strong);
  outline: none;
}

.shm-sidebar-figures {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 10px 0 0;
}

.shm-sidebar-figures > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.shm-sidebar-figures dt {
  color: var(--shm-text-muted);
}

.shm-sidebar-figures dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.shm-sidebar-figures dd.is-discount {
  color: var(--shm-success);
}

.shm-sidebar-note {
  margin: 8px 0 0;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

/*
 * Each notification in a light frame of its own, so several stand apart (Modern Hangar: a filled
 * cell, see modern.css).
 */
.shm-sidebar-melt-ready,
.shm-sidebar-notes li {
  padding: 8px;
  background: rgb(var(--shm-accent-rgb) / 0.06);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.18);
}

/*
 * Space below the title like the other boxes' figures (10 px), a little more for the frames, so the
 * first notification doesn't sit right under it.
 */
.shm-sidebar-box-content > .shm-sidebar-melt-ready:first-child,
.shm-sidebar-box-content > .shm-sidebar-notes:first-child {
  margin-top: 12px;
}

/*
 * The notifications worked out from the current state – marked pledges that can be melted now,
 * paints to buy again (#151) – each one for all of its pledges, laid out like the others – an
 * icon in place of the checkbox (it can't be checked off) and the text, then its actions as buttons
 * like those of the Paint Discount box (`.shm-sidebar-actions`). Side by side they take the full
 * width, so they fit more often (measured on RSI's page: English in Modern Hangar); stacked, they
 * are indented like the text above them (`is-wrapped`, see `v-mark-wrapped`).
 */
.shm-sidebar-melt-ready {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  column-gap: 8px;
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-sidebar-melt-ready > .shm-icon {
  margin-top: 2px;
  color: var(--shm-text-secondary);
}

.shm-sidebar-melt-ready p {
  margin: 0;
}

.shm-sidebar-melt-ready .shm-sidebar-actions {
  grid-column: 1 / -1;
  margin-top: 8px;
}

.shm-sidebar-melt-ready .shm-sidebar-actions.is-wrapped {
  grid-column: 2;
}

.shm-sidebar-melt-ready + .shm-sidebar-melt-ready,
.shm-sidebar-melt-ready + .shm-sidebar-notes {
  margin-top: 8px;
}

/* With an X in its top right corner that dismisses it; the text keeps clear of it. */
.shm-sidebar-melt-ready.is-dismissable {
  position: relative;
}

.shm-sidebar-melt-ready.is-dismissable p {
  padding-right: 16px;
}

.shm-sidebar-note-dismiss {
  position: absolute;
  top: 2px;
  right: 2px;
}

/* Notifications (#142): each with a checkbox to check it off, newest first. */
.shm-sidebar-notes,
.shm-sidebar-pending {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-sidebar-notes li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.shm-sidebar-note-check {
  flex: none;
  margin: 2px 0 0;
  accent-color: var(--shm-accent);
}

.shm-sidebar-note-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-sidebar-note-text a {
  color: inherit;
  text-decoration: none;
}

.shm-sidebar-note-text a:hover,
.shm-sidebar-note-text a:focus-visible {
  color: var(--shm-accent);
  text-decoration: underline;
}

.shm-sidebar-note-text .shm-sidebar-note {
  margin: 2px 0 0;
}

.shm-sidebar-subtitle {
  margin: 14px 0 6px;
  color: var(--shm-text-secondary);
  font-size: calc(11px * var(--shm-font-scale));
  text-transform: uppercase;
}

.shm-sidebar-pending li {
  display: flex;
  flex-direction: column;
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-sidebar-pending .shm-sidebar-note {
  margin: 0;
}

.shm-sidebar-pending-title {
  overflow: hidden;
  color: var(--shm-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * The buttons below a box's figures (the manager's buttons, see row.css and modern.css): side by
 * side, sharing the width; each takes a line of its own when the box is too narrow for both.
 */
.shm-sidebar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.shm-sidebar-button {
  flex: 1 1 auto;
  white-space: nowrap;
}

/* A single button of its own, e.g. bulk melting: the whole width, its label may wrap. */
.shm-sidebar-button.is-full {
  flex-basis: 100%;
  white-space: normal;
}

/* A switch that is on (the consultant's filter): filled, so it reads as pressed. */
.shm-sidebar-button[aria-pressed='true'] {
  color: var(--shm-text-strong);
  background: rgb(var(--shm-accent-rgb) / 0.32);
  border-color: var(--shm-accent);
}

/* A link-like button below a box's figures, e.g. to the Paint Discount Consultant. */
.shm-sidebar-link {
  display: inline-block;
  margin-top: 8px;
  padding: 0;
  color: var(--shm-accent);
  font: inherit;
  font-size: calc(12px * var(--shm-font-scale));
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-sidebar-link:hover,
.shm-sidebar-link:focus-visible {
  color: var(--shm-text-strong);
  text-decoration: underline;
  outline: none;
}

.shm-sidebar-note.is-warning {
  color: var(--shm-warning);
}

/* Only for screen readers. */
.shm-sidebar-status {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>

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
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { useStored } from '@/storage/use-stored';
import { useDemoContext } from '@/demo/use-demo';
import SidebarBox from './SidebarBox.vue';
import BulkExchangeOverlay from './BulkExchangeOverlay.vue';
import { checkOff, type AppNotification } from '@/notifications/notifications';
import { useOpenNotifications } from '@/notifications/use-notifications';
import { useMarkedPledges } from '../use-melt-marks';
import { formatTimeLeft } from '../melt-marks';
import { myGearHref } from '../route';
import { useNow } from '@/shared/use-now';
import {
  maybePaintConsultant,
  openPaintConsultant,
} from '@/store/paint-consultant/use-paint-consultant';
import { formatPercent } from '../discount-format';

/*
 * The sidebar below RSI's page navigation on the left on every tab (App.vue teleports it there),
 * a column of boxes: the store credit, the summary of the hangar's visible pledges (value,
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
const chosen = computed(() => (selected.value.length ? summarize(selected.value) : undefined));

// The account's store credit, not depending on search or selection. The demo mode shows a
// made-up one instead.
const storedCredit = useStored(storeCreditItem);
const demo = useDemoContext();
const credit = computed(() => {
  const stored = storedCredit.value;
  const value =
    demo.value?.storeCredit ??
    (stored?.version === STORE_CREDIT_VERSION ? stored.credit : undefined);
  if (!value) return undefined;
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: value.currency,
  }).format(value.amount);
});

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
/** Marked pledges that can't be melted yet, the soonest first. */
const pending = computed(() =>
  [...marked.value.values()]
    .filter((mark) => mark.meltableAt > now.value)
    .sort((a, b) => a.meltableAt - b.meltableAt),
);
const noteTime = computed(
  () => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }),
);
const noteText = (note: AppNotification) => i18n.t('notifications.meltable', [note.title]);
/** The pledge in RSI's "My Gear", if it is still in the hangar; not in the demo. */
function noteHref(note: AppNotification) {
  if (demo.value) return undefined;
  const pledge = props.pledges.find((candidate) => candidate.id === note.pledgeId);
  return pledge && myGearHref(location.pathname, pledge.page, pledge.id);
}

const TITLES = {
  notifications: 'notifications.title',
  storeCredit: 'summary.storeCredit',
  summary: 'summary.title',
  selection: 'summary.selected',
  paintConsultant: 'consultant.title',
} as const;

// The Paint Discount Consultant at first glance (worked out once in App.vue).
const consultant = maybePaintConsultant();
const rebuyPlan = computed(() => consultant?.result.value?.plan);
const rebuyShare = computed(() => {
  const plan = rebuyPlan.value;
  return plan && plan.meltValue > 0
    ? formatPercent((plan.storeCreditFreed / plan.meltValue) * 100, locale.value)
    : undefined;
});

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
      ? notes.value.length > 0
      : box === 'storeCredit' || box === 'paintConsultant'
        ? !props.settings.hideMeltValue && (box !== 'paintConsultant' || !!consultant)
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
        :title="
          box === 'notifications' && notes.length
            ? `${i18n.t(TITLES[box])} (${number.format(notes.length)})`
            : i18n.t(TITLES[box])
        "
        :dragging="box === dragged"
        :collapsed="isCollapsed(box)"
        @grab="(event) => grab(box, event)"
        @move="(step) => move(box, step)"
        @toggle="toggle(box)"
      >
        <template v-if="box === 'notifications'">
          <!-- Only shown with at least one open notification (see `isShown`). -->
          <ul class="shm-sidebar-notes">
            <li v-for="note in notes" :key="note.id">
              <input
                type="checkbox"
                class="shm-sidebar-note-check"
                :aria-label="`${i18n.t('notifications.checkOff')}: ${noteText(note)}`"
                @change="checkOff([note.id])"
              />
              <span class="shm-sidebar-note-text">
                <a v-if="noteHref(note)" :href="noteHref(note)">{{ noteText(note) }}</a>
                <template v-else>{{ noteText(note) }}</template>
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
                <span class="shm-sidebar-pending-title">{{ mark.title }}</span>
                <span class="shm-sidebar-note">
                  {{ i18n.t('meltMark.waiting', [formatTimeLeft(mark.meltableAt - now, locale)]) }}
                </span>
              </li>
            </ul>
          </template>
        </template>

        <dl v-else-if="box === 'storeCredit'" class="shm-sidebar-figures">
          <div>
            <dt>{{ i18n.t('sidebar.available') }}</dt>
            <dd>{{ credit ?? '–' }}</dd>
          </div>
        </dl>

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
          <!-- Disabled in the demo: its pledge ids are made up. -->
          <button
            v-if="settings.bulkMelting && meltable.length"
            v-tooltip="demo ? i18n.t('exchange.demo') : i18n.t('bulkExchange.buttonHint')"
            type="button"
            class="shm-button is-danger shm-sidebar-action"
            :disabled="!!demo"
            @click="bulkExchanging = true"
          >
            <SvgIcon name="triangle-exclamation" />
            {{ i18n.t('bulkExchange.button', [meltable.length]) }}
          </button>
          <BulkExchangeOverlay
            v-if="bulkExchanging"
            :pledges="meltable"
            :hangar="pledges"
            :skipped="selected.length - meltable.length"
            @close="bulkExchanging = false"
          />
        </template>

        <template v-else-if="box === 'paintConsultant'">
          <template v-if="rebuyPlan">
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
            <p v-if="rebuyShare" class="shm-sidebar-note">
              {{ i18n.t('consultant.boxShare', [rebuyShare, rebuyPlan.tier.paints]) }}
            </p>
          </template>
          <p v-else class="shm-sidebar-note">
            {{
              i18n.t(consultant?.storeItems.value ? 'consultant.boxNothing' : 'consultant.noItems')
            }}
          </p>
          <button type="button" class="shm-sidebar-link" @click="openPaintConsultant">
            {{ i18n.t('consultant.boxOpen') }}
          </button>
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
  box-sizing: border-box;
  padding: 12px 14px;
  background: rgb(var(--shm-surface-rgb) / 0.92);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.3);
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

/* An action on a box's pledges, e.g. bulk melting the selection. */
.shm-sidebar-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
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

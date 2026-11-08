<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { Settings } from '@/settings/settings';
import { useSettings } from '@/settings/use-settings';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import type { PledgeView } from '../pledge-view';
import { selection, visiblePledgeIds } from '../selection';
import { moveBox, placeBox, type SidebarBox as Box } from '../sidebar';
import { summarize, type PledgeSummary } from '../summary';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { useStored } from '@/storage/use-stored';
import { useDemoContext } from '@/demo/use-demo';
import SidebarBox from './SidebarBox.vue';

/*
 * The sidebar below RSI's page navigation on the left on every tab (App.vue teleports it there),
 * a column of boxes: the store credit, the summary of the hangar's visible pledges (value,
 * discounts, number) and – with a selection – the same of the selected ones. The boxes can be
 * moved up and down by their title, with the mouse or the arrow keys; the order is kept in the
 * settings (see `sidebar.ts`).
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

const TITLES = {
  storeCredit: 'summary.storeCredit',
  summary: 'summary.title',
  selection: 'summary.selected',
} as const;

// ---- Order ----

/** While dragging: the order the boxes would get when dropped there. */
const preview = ref<Box[]>();
/**
 * A new order until the settings have it: they are passed in from the manager and change only once
 * the stored settings did, so the boxes would jump back in between.
 */
const saved = ref<Box[]>();
watch(
  () => props.settings.sidebarOrder,
  () => (saved.value = undefined),
);
const current = computed(() => saved.value ?? props.settings.sidebarOrder);
const order = computed(() => preview.value ?? current.value);
const isShown = (box: Box) =>
  box === 'selection'
    ? !!chosen.value
    : box === 'storeCredit'
      ? !props.settings.hideMeltValue
      : true;
const boxes = computed(() => order.value.filter(isShown));

const root = useTemplateRef('root');
const boxElement = (box: Box) => root.value?.querySelector<HTMLElement>(`[data-box="${box}"]`);

function save(next: Box[]) {
  if (next.join() === current.value.join()) return false;
  saved.value = next;
  void update({ sidebarOrder: next });
  return true;
}

const dragged = ref<Box>();

/*
 * While dragging, the window follows the pointer: the boxes move in the page meanwhile, and an
 * element that is moved loses the pointer.
 */
function grab(box: Box) {
  dragged.value = box;
  preview.value = [...current.value];
  addEventListener('pointermove', drag);
  addEventListener('pointerup', drop);
  addEventListener('pointercancel', drop);
}

/** Puts the dragged box before the first other box whose middle is below the pointer. */
function drag(event: PointerEvent) {
  const box = dragged.value;
  if (!box || !preview.value) return;
  const others = boxes.value.filter((other) => other !== box);
  const below = others.find((other) => {
    const rect = boxElement(other)?.getBoundingClientRect();
    return rect && event.clientY < rect.top + rect.height / 2;
  });
  const last = others.at(-1);
  if (below) preview.value = placeBox(preview.value, box, below, false);
  else if (last) preview.value = placeBox(preview.value, box, last, true);
}

function drop() {
  removeEventListener('pointermove', drag);
  removeEventListener('pointerup', drop);
  removeEventListener('pointercancel', drop);
  if (!dragged.value) return;
  const next = preview.value;
  dragged.value = undefined;
  preview.value = undefined;
  if (next) save(next);
}

onUnmounted(drop);

/** For screen readers: where a box moved with the keyboard is now. */
const announcement = ref('');

async function move(box: Box, step: -1 | 1) {
  if (!save(moveBox(current.value, box, step, boxes.value))) return;
  await nextTick();
  // Moving the element in the page can take the focus away from its handle.
  boxElement(box)?.querySelector<HTMLElement>('.shm-sidebar-handle')?.focus();
  announcement.value = i18n.t('sidebar.moved', [boxes.value.indexOf(box) + 1, boxes.value.length]);
}
</script>

<template>
  <div
    ref="root"
    class="shm-sidebar"
    :class="themeClasses(settings)"
    :style="fontScaleStyle(settings)"
    role="region"
    :aria-label="i18n.t('sidebar.label')"
  >
    <template v-for="box in boxes" :key="box">
      <SidebarBox
        :data-box="box"
        :title="i18n.t(TITLES[box])"
        :dragging="box === dragged"
        @grab="grab(box)"
        @move="(step) => move(box, step)"
      >
        <dl v-if="box === 'storeCredit'" class="shm-sidebar-figures">
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
          <p v-if="settings.summaryTypes && chosen.types.length" class="shm-sidebar-note">
            {{ types(chosen) }}
          </p>
          <p v-if="hiddenSelected" class="shm-sidebar-note is-warning" role="status">
            {{ i18n.t('summary.hidden', [hiddenSelected]) }}
          </p>
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
    </template>
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

.shm-sidebar-box.is-dragging {
  opacity: 0.7;
  outline: 1px dashed var(--shm-accent);
  outline-offset: 2px;
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

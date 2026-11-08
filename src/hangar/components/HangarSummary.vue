<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { Settings } from '@/settings/settings';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import type { PledgeView } from '../pledge-view';
import { selection, visiblePledgeIds } from '../selection';
import { summarize, type PledgeSummary } from '../summary';
import { summaryPosition, type SummaryPosition } from '../summary-position';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { storeCreditItem, STORE_CREDIT_VERSION } from '@/account/store-credit-storage';
import { useStored } from '@/storage/use-stored';
import { useDemoContext } from '@/demo/use-demo';

/*
 * The summary box, below RSI's page navigation on the left on every tab (App.vue teleports it
 * there): value, discounts and number of the hangar's visible pledges, and – with a selection –
 * the same of the selected ones. It sticks while scrolling and can be dragged anywhere on the page; that
 * position lasts for the browser session (`summary-position.ts`).
 */

const props = defineProps<{ pledges: readonly PledgeView[]; settings: Settings }>();

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

// The store credit, first in the box (the account's, not depending on search or selection). The
// demo mode shows a made-up one instead.
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

// ---- Dragging ----

const box = useTemplateRef('box');
const position = ref<SummaryPosition>();
onMounted(async () => (position.value = (await summaryPosition.getValue()) ?? undefined));

/** Keeps the box inside the window, e.g. after the window got smaller. */
function clamp({ left, top }: SummaryPosition): SummaryPosition {
  const width = box.value?.offsetWidth ?? 0;
  const height = box.value?.offsetHeight ?? 0;
  return {
    left: Math.round(Math.min(Math.max(0, left), innerWidth - width)),
    top: Math.round(Math.min(Math.max(0, top), innerHeight - Math.min(height, 48))),
  };
}

let drag: { dx: number; dy: number } | undefined;

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || !box.value) return;
  const rect = box.value.getBoundingClientRect();
  drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  event.preventDefault();
}

function moveDrag(event: PointerEvent) {
  if (!drag) return;
  position.value = clamp({ left: event.clientX - drag.dx, top: event.clientY - drag.dy });
}

function endDrag() {
  if (!drag) return;
  drag = undefined;
  if (position.value) void summaryPosition.setValue(position.value);
}

/** The arrow keys move the box from the keyboard, Shift for bigger steps. */
function keyDrag(event: KeyboardEvent) {
  const steps: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const step = steps[event.key];
  if (!step || !box.value) return;
  event.preventDefault();
  const rect = box.value.getBoundingClientRect();
  const size = event.shiftKey ? 40 : 8;
  position.value = clamp({ left: rect.left + step[0] * size, top: rect.top + step[1] * size });
  void summaryPosition.setValue(position.value);
}

function resetPosition() {
  position.value = undefined;
  void summaryPosition.removeValue();
}

const keepInside = () => position.value && (position.value = clamp(position.value));
onMounted(() => addEventListener('resize', keepInside));
onUnmounted(() => removeEventListener('resize', keepInside));
</script>

<template>
  <section
    ref="box"
    class="shm-summary"
    :class="[themeClasses(settings), { 'is-moved': position }]"
    :style="[
      fontScaleStyle(settings),
      position && { left: `${position.left}px`, top: `${position.top}px` },
    ]"
    :aria-label="i18n.t('summary.title')"
  >
    <header class="shm-summary-head">
      <!-- The handle: drag with the mouse, or focus it and use the arrow keys. -->
      <span
        v-tooltip="i18n.t('summary.move')"
        class="shm-summary-handle"
        role="button"
        tabindex="0"
        :aria-label="i18n.t('summary.move')"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @keydown="keyDrag"
      >
        <SvgIcon name="grip-vertical" />
        <span class="shm-summary-title">{{ i18n.t('summary.title') }}</span>
      </span>
      <button
        v-if="position"
        v-tooltip="i18n.t('summary.resetPosition')"
        type="button"
        class="shm-summary-icon-button"
        :aria-label="i18n.t('summary.resetPosition')"
        @click="resetPosition"
      >
        <SvgIcon name="rotate-left" />
      </button>
    </header>

    <dl v-if="!settings.hideMeltValue" class="shm-summary-figures is-credit">
      <div>
        <dt>{{ i18n.t('summary.storeCredit') }}</dt>
        <dd>{{ credit ?? '–' }}</dd>
      </div>
    </dl>

    <dl class="shm-summary-figures">
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
    <p v-if="settings.summaryTypes && shown.types.length" class="shm-summary-types">
      {{ types(shown) }}
    </p>

    <div v-if="chosen" class="shm-summary-selection">
      <div class="shm-summary-selection-head">
        <span class="shm-summary-title">{{ i18n.t('summary.selected') }}</span>
        <button
          v-tooltip="i18n.t('summary.clear')"
          type="button"
          class="shm-summary-icon-button"
          :aria-label="i18n.t('summary.clear')"
          @click="selection.clear()"
        >
          <SvgIcon name="xmark" />
        </button>
      </div>
      <dl class="shm-summary-figures">
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
      <p v-if="settings.summaryTypes && chosen.types.length" class="shm-summary-types">
        {{ types(chosen) }}
      </p>
      <p v-if="hiddenSelected" class="shm-summary-hidden" role="status">
        {{ i18n.t('summary.hidden', [hiddenSelected]) }}
      </p>
    </div>
  </section>
</template>

<style>
/* Classic RSI: square, outlined like RSI's own boxes. "Modern Hangar": modern.css. */
.shm-summary {
  box-sizing: border-box;
  width: 100%;
  padding: 12px 14px;
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
  line-height: 1.4;
  background: rgb(var(--shm-surface-rgb) / 0.92);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.3);
}

/*
 * In its place, it ends where RSI's navigation items end (their background stops 21 px before the
 * column's edge), so it keeps a gap to the manager, which starts right after the column.
 */
.shm-summary.shm-theme-rsi:not(.is-moved) {
  width: calc(100% - 21px);
}

/* Moved by the user: fixed where it was dropped, above the page. */
.shm-summary.is-moved {
  position: fixed;
  z-index: 100000;
  width: 215px;
  box-shadow: 0 12px 30px rgb(0 0 0 / 0.45);
}

.shm-summary-head,
.shm-summary-selection-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.shm-summary-handle {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.shm-summary-handle:active {
  cursor: grabbing;
}

.shm-summary-handle .shm-icon {
  color: var(--shm-text-faint);
}

.shm-summary-handle:focus-visible {
  outline: 1px solid var(--shm-accent);
  outline-offset: 2px;
}

.shm-summary-title {
  color: var(--shm-accent);
  font-size: calc(11px * var(--shm-font-scale));
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-summary-icon-button {
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

.shm-summary-icon-button:hover,
.shm-summary-icon-button:focus-visible {
  color: var(--shm-text-strong);
  outline: none;
}

.shm-summary-figures {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 10px 0 0;
}

.shm-summary-figures > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.shm-summary-figures dt {
  color: var(--shm-text-muted);
}

.shm-summary-figures dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.shm-summary-figures.is-credit {
  padding-bottom: 8px;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
}

.shm-summary-figures.is-credit + .shm-summary-figures {
  margin-top: 8px;
}

.shm-summary-figures dd.is-discount {
  color: var(--shm-success);
}

.shm-summary-types,
.shm-summary-hidden {
  margin: 8px 0 0;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-summary-hidden {
  color: var(--shm-warning);
}

.shm-summary-selection {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
}
</style>

<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { startSync, syncState } from '../sync-state';
import RefreshIcon from './RefreshIcon.vue';

/*
 * The manager's refresh button: one icon and a text beside it. A refresh plays in steps of
 * `STEP_MS`: "Refresh" fades out while the icon starts spinning and the text widens (icon and
 * text stay centred, so the icon moves left); then the page counter and the bar fade in. When it
 * is done they fade out, the text narrows back (the icon moves right) as the icon stops spinning,
 * and "Refresh" fades in again.
 *
 * The text's width is measured, not guessed: hidden copies in the button's own font give the
 * width of "Refresh" and of the counter with as many digits as the total page count has, twice
 * ("123 / 123 · 100 %"), so the button keeps its width while the pages count up.
 */

/** `hidden`: kept in the layout (the header keeps its height), but invisible and not focusable. */
defineProps<{ hidden?: boolean }>();

const STEP_MS = 200;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const step = () => (reducedMotion.matches ? 0 : STEP_MS);

/** Progress of a running sync: pages for the counter, weighted work for the bar and percentage. */
const progress = computed(() => {
  const current = syncState.progress;
  if (!current) return null;
  // Rounded down, so 100 % only shows once everything is read.
  const fraction = Math.floor(current.fraction * 100) / 100;
  const percent = new Intl.NumberFormat(locale.value, { style: 'percent' }).format(fraction);
  return {
    ...current,
    fraction,
    percent,
    text: i18n.t('manager.syncProgress', [current.done, current.total, percent]),
  };
});

/** The last progress, kept while counter and bar fade out after the sync (it ends with none). */
const shown = ref<typeof progress.value>(null);
watch(progress, (current) => {
  if (current) shown.value = current;
});

type Phase = 'idle' | 'growing' | 'busy' | 'fading' | 'shrinking';
const phase = ref<Phase>(syncState.running ? 'busy' : 'idle');
let timer: ReturnType<typeof setTimeout> | undefined;
const after = (next: () => void) => {
  clearTimeout(timer);
  timer = setTimeout(next, step());
};

watch(
  () => syncState.running,
  (running) => {
    if (running) {
      shown.value = null;
      phase.value = 'growing';
      after(() => (phase.value = 'busy'));
    } else {
      phase.value = 'fading';
      after(() => {
        phase.value = 'shrinking';
        after(() => {
          phase.value = 'idle';
          // Faded out: the counter of the finished sync isn't needed any more.
          shown.value = null;
        });
      });
    }
  },
);
onUnmounted(() => clearTimeout(timer));

/** Digits of the total page count; until it is known, those of the last refresh. */
const digits = ref(3);
watch(
  () => progress.value?.total,
  (total) => {
    if (total) digits.value = String(total).length;
  },
);
const sizerCounter = computed(() => {
  const pages = '0'.repeat(digits.value);
  const full = new Intl.NumberFormat(locale.value, { style: 'percent' }).format(1);
  return `${pages} / ${pages} · ${full}`;
});

const idleSizer = useTemplateRef<HTMLElement>('idleSizer');
const busySizer = useTemplateRef<HTMLElement>('busySizer');
const idleWidth = ref(0);
const busyWidth = ref(0);
// Follows the sizers, so a late web font or another language resizes the button too.
const observer = new ResizeObserver(() => {
  idleWidth.value = Math.ceil(idleSizer.value?.getBoundingClientRect().width ?? 0);
  busyWidth.value = Math.ceil(busySizer.value?.getBoundingClientRect().width ?? 0);
});
onMounted(() => {
  if (idleSizer.value) observer.observe(idleSizer.value);
  if (busySizer.value) observer.observe(busySizer.value);
});
onUnmounted(() => observer.disconnect());

const textWidth = computed(() => {
  const width = phase.value === 'idle' || phase.value === 'shrinking' ? idleWidth : busyWidth;
  return width.value ? `${width.value}px` : undefined;
});

/** Spins from the click until the button narrows back. */
const spinning = computed(() => phase.value !== 'idle' && phase.value !== 'shrinking');
</script>

<template>
  <button
    type="button"
    class="shadow-button trans-02s trans-color shm-refresh"
    :class="[`is-${phase}`, { 'is-hidden': hidden }]"
    :disabled="syncState.running"
    :title="progress?.text ?? i18n.t('manager.refresh')"
    :aria-label="i18n.t('manager.refresh')"
    :aria-busy="syncState.running"
    @click="startSync"
  >
    <span class="label js-label shm-refresh-label">
      <RefreshIcon :spinning="spinning" />
      <span class="shm-refresh-text" :style="{ width: textWidth }">
        <span class="shm-refresh-word is-idle">{{ i18n.t('manager.refreshLabel') }}</span>
        <span class="shm-refresh-word is-busy shm-refresh-progress">
          <template v-if="shown">
            {{ shown.done }} / {{ shown.total }} · {{ shown.percent }}
          </template>
        </span>
      </span>
    </span>
    <!-- Invisible copies that give the two widths of the text (see above). -->
    <span class="shm-refresh-sizers" aria-hidden="true">
      <span ref="idleSizer">{{ i18n.t('manager.refreshLabel') }}</span>
      <span ref="busySizer" class="shm-refresh-progress">{{ sizerCounter }}</span>
    </span>
    <!-- The bar follows the estimated work, not the pages: buy back pages take much longer. -->
    <span
      class="shm-refresh-bar"
      :role="progress ? 'progressbar' : undefined"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="progress ? Math.round(progress.fraction * 100) : undefined"
      :aria-valuetext="progress?.text"
      :aria-hidden="progress ? undefined : 'true'"
    >
      <span
        class="shm-refresh-bar-fill"
        :style="{ transform: `scaleX(${shown?.fraction ?? 0})` }"
      ></span>
    </span>
    <span class="left-section"></span>
    <span class="right-section"></span>
  </button>
</template>

<style scoped>
.shm-refresh {
  display: block !important;
  /*
   * RSI's background has a 30 px button face with a reflection below (40 px in all). The bottom
   * padding keeps the content on the face; a <button> centres it vertically in what's left.
   */
  padding: 0 12px 10px !important;
  font-family: Electrolize, sans-serif !important;
  font-size: 11px !important;
  line-height: 30px !important;
  position: relative !important;
  box-sizing: border-box;
  /* RSI's `.shadow-button` background (the middle part between the two end sections) stays. */
  border: 0;
  cursor: pointer;
}

.shm-refresh.is-hidden {
  visibility: hidden;
}

.shm-refresh:disabled {
  cursor: progress;
}

/* Icon and text side by side, centred on the button face. */
.shm-refresh-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
}

/*
 * "Refresh" and the counter on top of each other, both from the left edge next to the icon; the
 * width changes between theirs.
 */
.shm-refresh-text {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
  transition: width 0.2s ease;
}

.shm-refresh-word {
  grid-area: 1 / 1;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.shm-refresh.is-idle .shm-refresh-word.is-idle,
.shm-refresh.is-busy .shm-refresh-word.is-busy {
  opacity: 1;
}

.shm-refresh-sizers {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  /* Each copy at its own width, not stretched to the wider one. */
  align-items: flex-start;
  visibility: hidden;
  pointer-events: none;
}

.shm-refresh-progress {
  font-variant-numeric: tabular-nums;
}

/* Along the lower edge of the button face (RSI's background shows a reflection below it). */
.shm-refresh-bar {
  position: absolute;
  top: 27px;
  right: 12px;
  left: 12px;
  height: 2px;
  overflow: hidden;
  background: rgb(var(--shm-accent-rgb) / 0.2);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.shm-refresh.is-busy .shm-refresh-bar {
  opacity: 1;
}

/* Scaled instead of resized: smooth steps between the pages without re-layout. */
.shm-refresh-bar-fill {
  display: block;
  height: 100%;
  background: var(--shm-accent);
  transform-origin: left;
  transition: transform 0.4s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .shm-refresh-text,
  .shm-refresh-word,
  .shm-refresh-bar,
  .shm-refresh-bar-fill {
    transition: none;
  }
}
</style>

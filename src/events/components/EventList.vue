<script setup lang="ts">
import SvgIcon from '@/icons/SvgIcon.vue';
import { i18n, locale } from '@/i18n';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { formatCountdown } from '../countdown';
import { formatEventTime } from '../event-notes';
import {
  eventProgress,
  eventState,
  localized,
  shownEvents,
  type EventPhase,
  type StarCitizenEvent,
} from '../events';

/*
 * The events of the project website whose display period lasts (#69), at the top of the Pledge
 * Store tab: name, period, description and image if given, and live countdowns – to the start, or
 * while it runs to its next phase (e.g. the next manufacturer of the IAE, "Best in Show", the
 * finale) and its end. Built from the rows of the manager's lists, so it fits every theme; nothing
 * to expand. Texts are plain text: Vue escapes them.
 */

const props = defineProps<{ events: readonly StarCitizenEvent[] }>();

/** The countdowns tick every second, only while the page is visible. */
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') now.value = Date.now();
  }, 1000);
});
onUnmounted(() => clearInterval(timer));

/** A countdown: the text before the time, the time, and the text after it. */
interface Countdown {
  label: string;
  time: string;
  after?: string;
}

const rows = computed(() =>
  shownEvents(props.events, now.value).map((event) => {
    const state = eventState(event, now.value);
    const name = (text: StarCitizenEvent['name']) => localized(text, locale.value);
    const left = (at: number) => formatCountdown(at - now.value, locale.value);
    const short = (phase: EventPhase) => name(phase.shortName ?? phase.name);
    const { current, next } = eventProgress(event, now.value);
    const countdowns: Countdown[] =
      state === 'upcoming'
        ? [
            {
              label: i18n.t('events.countdownStart'),
              time: left(event.eventStart),
              // The first phase, if it starts with the event: "with RSI".
              ...(next?.start === event.eventStart && {
                after: i18n.t('events.startsWith', [short(next)]),
              }),
            },
          ]
        : [
            ...(next
              ? [{ label: i18n.t('events.nextIn', [short(next)]), time: left(next.start) }]
              : []),
            { label: i18n.t('events.countdownEnd'), time: left(event.eventEnd) },
          ];
    return {
      event,
      name: name(event.name),
      description: event.description && name(event.description),
      state,
      period: `${formatEventTime(event.eventStart, locale.value)} – ${formatEventTime(event.eventEnd, locale.value)}`,
      current:
        state === 'running' && current ? i18n.t('events.now', [name(current.name)]) : undefined,
      countdowns,
    };
  }),
);
</script>

<template>
  <section v-if="rows.length" class="shm-events" aria-labelledby="shm-events-title">
    <h3 id="shm-events-title" class="shm-store-title">{{ i18n.t('events.title') }}</h3>
    <div class="shm-rows">
      <article v-for="row in rows" :key="row.event.id" class="shm-row shm-event">
        <div class="shm-row-summary">
          <span class="shm-thumb shm-event-thumb">
            <img
              v-if="row.event.image"
              :src="row.event.image"
              alt=""
              loading="lazy"
              decoding="async"
              width="128"
              height="72"
            />
            <SvgIcon v-else name="award" />
          </span>
          <span class="shm-main">
            <span class="shm-title">{{ row.name }}</span>
            <span class="shm-meta">
              <time :datetime="new Date(row.event.eventStart).toISOString()">{{ row.period }}</time>
            </span>
            <span v-if="row.description" class="shm-event-description">
              {{ row.description }}
            </span>
            <span v-if="row.current" class="shm-event-current">{{ row.current }}</span>
            <!-- No live region: reading out every second would be noise. -->
            <span class="shm-event-countdowns">
              <span v-for="countdown in row.countdowns" :key="countdown.label">
                {{ countdown.label }}
                <span class="shm-event-countdown">{{ countdown.time }}</span>
                <!-- The space in the text: Vue drops whitespace between tags across a line break. -->
                {{ countdown.after ? ` ${countdown.after}` : '' }}
              </span>
            </span>
          </span>
          <span class="shm-badges">
            <span class="shm-badge shm-event-state" :class="`is-${row.state}`">
              {{ i18n.t(`events.${row.state}`) }}
            </span>
          </span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.shm-events {
  margin-bottom: 28px;
}

.shm-events .shm-rows {
  margin-top: 10px;
}

/* Nothing to open: no pointer, no hover. */
.shm-event .shm-row-summary {
  cursor: default;
}

.shm-event .shm-row-summary:hover {
  background: none;
}

.shm-event-thumb {
  display: grid;
  place-items: center;
  color: var(--shm-accent);
  font-size: calc(26px * var(--shm-font-scale));
}

/* The description wraps, unlike the one-line texts of the other rows. */
.shm-event-description {
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
  line-height: 1.45;
}

.shm-event-current {
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-event-countdowns {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 18px;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
}

/* The time itself stands out and keeps its width while it ticks. */
.shm-event-countdown {
  color: var(--shm-text-strong);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.shm-event-state.is-running {
  color: var(--shm-success);
  border-color: rgb(var(--shm-success-rgb) / 0.6);
}
</style>

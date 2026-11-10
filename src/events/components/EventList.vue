<script setup lang="ts">
import SvgIcon from '@/icons/SvgIcon.vue';
import { i18n, locale } from '@/i18n';
import { useNow } from '@/shared/use-now';
import { computed } from 'vue';
import { formatEventTime } from '../event-notes';
import { eventState, shownEvents, type StarCitizenEvent } from '../events';
import { formatUntil } from '../format-until';

/*
 * The events of the project website whose display period lasts (#69), at the top of the Pledge
 * Store tab: name, period, whether it is upcoming or running, and the description and icon if
 * given. Built from the rows of the manager's lists, so it fits every theme; nothing to expand.
 * Texts are plain text: Vue escapes them.
 */

const props = defineProps<{ events: readonly StarCitizenEvent[] }>();

const now = useNow();

const rows = computed(() =>
  shownEvents(props.events, now.value).map((event) => {
    const state = eventState(event, now.value);
    return {
      event,
      state,
      period: `${formatEventTime(event.eventStart, locale.value)} – ${formatEventTime(event.eventEnd, locale.value)}`,
      status:
        state === 'upcoming'
          ? i18n.t('events.startsIn', [formatUntil(event.eventStart, now.value, locale.value)])
          : i18n.t('events.endsIn', [formatUntil(event.eventEnd, now.value, locale.value)]),
    };
  }),
);
</script>

<template>
  <section v-if="rows.length" class="shm-events" aria-labelledby="shm-events-title">
    <h3 id="shm-events-title" class="shm-store-title">{{ i18n.t('events.title') }}</h3>
    <p class="shm-store-intro">{{ i18n.t('events.intro') }}</p>
    <div class="shm-rows">
      <article v-for="row in rows" :key="row.event.id" class="shm-row shm-event">
        <div class="shm-row-summary">
          <span class="shm-thumb shm-event-thumb">
            <img
              v-if="row.event.icon"
              :src="row.event.icon"
              alt=""
              loading="lazy"
              decoding="async"
              width="128"
              height="72"
            />
            <SvgIcon v-else name="award" />
          </span>
          <span class="shm-main">
            <span class="shm-title">{{ row.event.name }}</span>
            <span class="shm-meta">
              <time :datetime="new Date(row.event.eventStart).toISOString()">{{ row.period }}</time>
            </span>
            <span v-if="row.event.description" class="shm-event-description">
              {{ row.event.description }}
            </span>
          </span>
          <span class="shm-badges">
            <span class="shm-badge shm-event-state" :class="`is-${row.state}`">
              {{ i18n.t(`events.${row.state}`) }} · {{ row.status }}
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

.shm-event-state.is-running {
  color: var(--shm-success);
  border-color: rgb(var(--shm-success-rgb) / 0.6);
}
</style>

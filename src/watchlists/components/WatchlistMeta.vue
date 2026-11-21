<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import type { Watchlist } from '../watchlists';

/*
 * What a watchlist holds, in one line (#467): its item count, and its date with whether a reminder
 * comes then.
 */

const props = defineProps<{ list: Watchlist }>();

const count = computed(() =>
  i18n.n('watchlists.items', props.list.items.length, [
    new Intl.NumberFormat(locale.value).format(props.list.items.length),
  ]),
);
const date = computed(() =>
  props.list.dueAt === undefined
    ? undefined
    : new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
        props.list.dueAt,
      ),
);
const reminderText = computed(() =>
  i18n.t(props.list.reminder ? 'watchlists.reminderOn' : 'watchlists.reminderOff'),
);
</script>

<template>
  <span class="shm-watchlist-meta">
    <span>{{ count }}</span>
    <span v-if="date" class="shm-watchlist-date-meta">
      <SvgIcon
        v-tooltip="reminderText"
        :name="list.reminder ? 'bell' : 'bell-slash'"
        :class="{ 'is-on': list.reminder }"
        :label="reminderText"
      />
      <time :datetime="new Date(list.dueAt!).toISOString()">{{ date }}</time>
    </span>
  </span>
</template>

<style>
.shm-watchlist-meta {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 14px;
  color: var(--shm-text-muted);
  font-size: calc(12px * var(--shm-font-scale));
  font-variant-numeric: tabular-nums;
}

.shm-watchlist-date-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.shm-watchlist-date-meta .shm-icon.is-on {
  color: var(--shm-accent);
}
</style>

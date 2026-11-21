<script setup lang="ts">
import { i18n } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import { watchlistsByItem } from '../use-watchlists';
import type { Watchlist } from '../watchlists';

/*
 * The notepad of a collapsed item that is on at least one watchlist (#468), with their names in its
 * tooltip. A group of the grouped view gives the keys of all its items: it shows the watchlists
 * any of them is on.
 */

const props = defineProps<{ itemKeys: readonly string[] }>();

const lists = computed(() => {
  const found = new Map<string, Watchlist>();
  for (const key of props.itemKeys) {
    for (const list of watchlistsByItem.value.get(key) ?? []) found.set(list.id, list);
  }
  return [...found.values()];
});
const hint = computed(() =>
  i18n.n('watchlists.onLists', lists.value.length, [
    lists.value.map((list) => list.name).join(', '),
  ]),
);
</script>

<template>
  <span
    v-if="lists.length"
    v-tooltip="hint"
    class="shm-badge is-watchlist"
    role="img"
    :aria-label="hint"
    tabindex="0"
  >
    <SvgIcon name="clipboard-list" />
  </span>
</template>

<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { Watchlist } from '../watchlists';
import { loadWatchlists, watchWatchlists } from '../watchlists-storage';

/*
 * The tab "Watchlists" (#466), second to last before the settings: the user's watchlists (#464)
 * with their item counts, or what they are for while there is none. The view of a watchlist, with
 * creating and editing it, follows (#467). The demo shows its own lists (#474).
 */

const props = defineProps<{ demo: boolean }>();

const lists = ref<Watchlist[]>([]);
let stop: (() => void) | undefined;
async function follow(demo: boolean) {
  stop?.();
  lists.value = await loadWatchlists(demo);
  stop = watchWatchlists((value) => (lists.value = value), demo);
}
onMounted(() => void follow(props.demo));
watch(
  () => props.demo,
  (demo) => void follow(demo),
);
onUnmounted(() => stop?.());

const count = (list: Watchlist) =>
  i18n.n('watchlists.items', list.items.length, [
    new Intl.NumberFormat(locale.value).format(list.items.length),
  ]);
</script>

<template>
  <section class="shm-watchlists" aria-labelledby="shm-watchlists-title">
    <h3 id="shm-watchlists-title" class="shm-store-title shm-watchlists-title">
      <SvgIcon name="clipboard-list" />
      {{ i18n.t('tabs.watchlists') }}
    </h3>
    <p class="shm-watchlists-intro">{{ i18n.t('watchlists.intro') }}</p>
    <ul v-if="lists.length" class="shm-watchlists-list">
      <li v-for="list in lists" :key="list.id">
        <span class="shm-watchlists-name">{{ list.name }}</span>
        <span class="shm-watchlists-count">{{ count(list) }}</span>
      </li>
    </ul>
    <p v-else class="shm-watchlists-empty">{{ i18n.t('watchlists.empty') }}</p>
  </section>
</template>

<style scoped>
.shm-watchlists {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.shm-watchlists-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
}

.shm-watchlists-title .shm-icon {
  color: var(--shm-accent);
}

.shm-watchlists-intro,
.shm-watchlists-empty {
  margin: 0;
  color: var(--shm-text-muted);
}

.shm-watchlists-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-watchlists-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.shm-watchlists-count {
  color: var(--shm-text-muted);
  font-variant-numeric: tabular-nums;
}
</style>

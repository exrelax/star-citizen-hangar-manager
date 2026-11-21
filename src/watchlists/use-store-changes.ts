import { isKindOn } from '@/notifications/kinds';
import { useSettings } from '@/settings/use-settings';
import { useStored } from '@/storage/use-stored';
import { computed, watch } from 'vue';
import { useStoreCatalog } from './use-store-catalog';
import { watchlists, watchlistsDemo } from './use-watchlists';
import {
  demoStoreSeenItem,
  storeChangesOf,
  storeSeenItem,
  withSeen,
  type WatchlistChanges,
} from './watch-store-changes';
import type { Watchlist } from './watchlists';

/**
 * The changes of the watchlists' Pledge Store items (#472) for the manager: the sidebar shows them,
 * and seeing a watchlist or dismissing its notification notes its items as they are now. The
 * background script notes the items seen for the first time; the demo's own lists (#474) are noted
 * here, as the background script never looks at them.
 */
export function useStoreChanges() {
  const { settings } = useSettings();
  const catalog = useStoreCatalog();
  const realSeen = useStored(storeSeenItem);
  const demoSeen = useStored(demoStoreSeenItem);
  const item = () => (watchlistsDemo.value ? demoStoreSeenItem : storeSeenItem);
  const seen = computed(() => (watchlistsDemo.value ? demoSeen.value : realSeen.value));

  const result = computed(() =>
    seen.value ? storeChangesOf(watchlists.value, catalog.value, seen.value) : undefined,
  );
  watch(result, (now) => {
    if (watchlistsDemo.value && now && Object.keys(now.noted).length) {
      void demoStoreSeenItem.setValue({ ...seen.value, ...now.noted });
    }
  });

  /** The changes to show; none with the kind turned off (#197). */
  const changed = computed((): WatchlistChanges[] =>
    isKindOn(settings.value.notificationsOff, 'watchlistStore')
      ? (result.value?.changed ?? [])
      : [],
  );

  /** Notes the watchlist's store items as they are now: it was seen, or dismissed. */
  function acknowledge(list: Watchlist) {
    if (!seen.value || !result.value?.changed.some((entry) => entry.list.id === list.id)) return;
    void item().setValue(withSeen(seen.value, list, catalog.value));
  }

  return { changed, acknowledge };
}

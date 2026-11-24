import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  addItemsToWatchlist,
  addToWatchlist,
  createWatchlistWith,
  createWatchlistWithItems,
  followWatchlists,
  removeFromWatchlist,
  storeWatchlist,
  watchlists,
  watchlistsByItem,
  watchlistsLoaded,
} from './use-watchlists';
import { itemKey } from './watchlists';
import { loadWatchlists } from './watchlists-storage';

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve));
  await nextTick();
};

const nomad = { kind: 'hangar' as const, pledgeId: 7, name: 'Nomad', value: 80 };
const paint = { kind: 'buyback' as const, pledgeId: 9, name: 'Paint' };

let stop: (() => void) | undefined;
const demo = ref(false);
beforeEach(async () => {
  fakeBrowser.reset();
  demo.value = false;
  stop = followWatchlists(demo);
  await flush();
});
afterEach(() => stop?.());

describe('the watchlists of an item (#468)', () => {
  it('creates a watchlist with the item on it', async () => {
    const list = await createWatchlistWith('  IAE  ', nomad);
    expect(list.name).toBe('IAE');
    expect(watchlistsByItem.value.get('h:7')?.map((other) => other.id)).toEqual([list.id]);
    // Stored in seconds: compared by what identifies them.
    expect(await loadWatchlists()).toMatchObject([
      { id: list.id, name: 'IAE', items: [{ kind: 'hangar', pledgeId: 7, value: 80 }] },
    ]);
  });

  it('puts the item on another watchlist and takes it off again', async () => {
    const first = await createWatchlistWith('IAE', nomad);
    const second = await createWatchlistWith('Later', paint);
    await addToWatchlist(second.id, nomad);
    expect(watchlistsByItem.value.get('h:7')?.map((list) => list.name)).toEqual(['IAE', 'Later']);
    await removeFromWatchlist(first.id, 'h:7');
    expect(watchlistsByItem.value.get('h:7')?.map((list) => list.name)).toEqual(['Later']);
    expect((await loadWatchlists()).map((list) => list.items.length)).toEqual([0, 2]);
  });

  it('keeps the demo’s watchlists apart from the account’s', async () => {
    await createWatchlistWith('Mine', nomad);
    demo.value = true;
    await flush();
    expect(watchlistsLoaded.value).toBe(true);
    expect(watchlists.value).toEqual([]);
    await createWatchlistWith('Demo', paint);
    expect((await loadWatchlists(true)).map((list) => list.name)).toEqual(['Demo']);
    expect((await loadWatchlists()).map((list) => list.name)).toEqual(['Mine']);
  });
});

describe('the selection of My Hangar on a watchlist (#549)', () => {
  const ccu = { kind: 'hangar' as const, pledgeId: 8, name: 'CCU', value: 15 };

  it('puts all selected pledges on a watchlist, each once, and tells how many were new', async () => {
    const list = await createWatchlistWith('IAE', nomad);
    expect(await addItemsToWatchlist(list.id, [nomad, ccu])).toBe(1);
    expect(watchlistsByItem.value.get('h:8')?.map((other) => other.name)).toEqual(['IAE']);
    expect((await loadWatchlists())[0]?.items).toHaveLength(2);
  });

  it('makes a new watchlist with all of them', async () => {
    const list = await createWatchlistWithItems('Melt', [nomad, ccu]);
    expect(list.items.map((item) => item.kind === 'hangar' && item.pledgeId)).toEqual([7, 8]);
    expect(await loadWatchlists()).toMatchObject([{ name: 'Melt' }]);
  });
});

describe('quick changes of a watchlist (#658)', () => {
  it('builds each change on the one before and stores them in order', async () => {
    const list = await createWatchlistWith('IAE', nomad);
    // Two quick changes: the second starts before the first is stored.
    const first = removeFromWatchlist(list.id, 'h:7');
    const second = addToWatchlist(list.id, paint);
    await Promise.all([first, second]);
    await flush();
    expect(watchlists.value[0]?.items.map(itemKey)).toEqual(['b:9']);
    expect((await loadWatchlists())[0]?.items.map(itemKey)).toEqual(['b:9']);
  });

  it('puts the watchlist back when it can’t be stored', async () => {
    const list = await createWatchlistWith('IAE', nomad);
    const set = fakeBrowser.storage.sync.set;
    fakeBrowser.storage.sync.set = () => Promise.reject(new Error('Sync is switched off'));
    try {
      await expect(storeWatchlist({ ...list, name: 'Other' })).rejects.toThrow();
    } finally {
      fakeBrowser.storage.sync.set = set;
    }
    expect(watchlists.value.map((other) => other.name)).toEqual(['IAE']);
  });
});

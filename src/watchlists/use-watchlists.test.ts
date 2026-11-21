import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  addToWatchlist,
  createWatchlistWith,
  followWatchlists,
  removeFromWatchlist,
  watchlists,
  watchlistsByItem,
  watchlistsLoaded,
} from './use-watchlists';
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

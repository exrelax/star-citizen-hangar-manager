import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { addItem, createWatchlist, type Watchlist } from './watchlists';
import {
  SYNC_QUOTA,
  WatchlistQuotaError,
  bytesOf,
  decodeWatchlist,
  deleteWatchlist,
  encodeWatchlist,
  exceededLimit,
  loadWatchlists,
  reorderWatchlists,
  saveWatchlist,
  watchWatchlists,
} from './watchlists-storage';

beforeEach(() => fakeBrowser.reset());

const NOW = Date.parse('2026-11-20T12:00:00Z');

function full(): Watchlist {
  let list = createWatchlist(
    { name: 'IAE', description: 'Melt after the event', dueAt: NOW + 86_400_000 },
    NOW,
    'a1',
  );
  list = addItem(list, { kind: 'hangar', pledgeId: 112662775, name: 'Polaris', value: 270 }, NOW);
  list = addItem(list, { kind: 'buyback', pledgeId: 5, name: 'Paint' }, NOW);
  list = addItem(
    list,
    { kind: 'storePaint', skuId: 9, name: 'Quasar', value: 14.3, count: 2 },
    NOW,
  );
  list = addItem(list, { kind: 'storeCcu', fromShipId: 1, toShipId: 2, name: 'CCU' }, NOW);
  return list;
}

describe('the stored form of a watchlist (#465)', () => {
  it('comes back as it was', () => {
    expect(decodeWatchlist('a1', encodeWatchlist(full()))).toEqual(full());
  });

  it('is small: an item as a tuple, times in seconds', () => {
    const stored = encodeWatchlist(full());
    expect(stored.i[0]).toEqual(['h', 112662775, 'Polaris', NOW / 1000, 270]);
    expect(stored.i[2]).toEqual(['p', 9, 'Quasar', NOW / 1000, 14.3, 2]);
    expect(stored.i[3]).toEqual(['c', '1-2', 'CCU', NOW / 1000]);
  });

  it('leaves out unknown items and gives nothing for an unknown format', () => {
    const stored = {
      ...encodeWatchlist(full()),
      i: [
        ['x', 1, 'Odd', 1],
        ['h', 1, 'Ok', 1],
      ],
    };
    expect(decodeWatchlist('a1', stored)!.items.map((item) => item.name)).toEqual(['Ok']);
    expect(decodeWatchlist('a1', { v: 2 })).toBeUndefined();
    expect(decodeWatchlist('a1', null)).toBeUndefined();
  });
});

describe('the limits of the synced storage (#465)', () => {
  it('tells which limit a write would exceed', () => {
    const big = 'x'.repeat(SYNC_QUOTA.perItem);
    expect(exceededLimit('watchlist.a', { n: big }, {})).toBe('list');
    const others = Object.fromEntries(
      Array.from({ length: 13 }, (_, index) => [`k${index}`, 'y'.repeat(8000)]),
    );
    expect(exceededLimit('watchlist.a', { n: 'z'.repeat(1000) }, others)).toBe('total');
    const many = Object.fromEntries(
      Array.from({ length: SYNC_QUOTA.maxItems }, (_, i) => [`k${i}`, 1]),
    );
    expect(exceededLimit('watchlist.a', 1, many)).toBe('items');
    expect(exceededLimit('watchlist.a', encodeWatchlist(full()), {})).toBeUndefined();
  });

  it('counts the bytes of key and value as UTF-8', () => {
    expect(bytesOf('k', 'ä')).toBe(1 + 4);
  });

  it('refuses a list too big for one key and writes nothing', async () => {
    let list = createWatchlist({ name: 'Huge' }, NOW, 'big');
    for (let id = 0; id < 200; id++) {
      list = addItem(
        list,
        { kind: 'hangar', pledgeId: id, name: `Pledge ${id}`.padEnd(40, '.') },
        NOW,
      );
    }
    await expect(saveWatchlist(list)).rejects.toEqual(new WatchlistQuotaError('list'));
    expect(await loadWatchlists()).toEqual([]);
    expect(await browser.storage.sync.get(null)).toEqual({});
  });
});

describe('reading and writing the watchlists (#465)', () => {
  it('keeps each list in a key of its own, in the order made', async () => {
    const second = createWatchlist({ name: 'CCUs to buy' }, NOW, 'b2');
    await saveWatchlist(full());
    await saveWatchlist(second);
    expect(Object.keys(await browser.storage.sync.get(null)).sort()).toEqual([
      'watchlist.a1',
      'watchlist.b2',
      'watchlists',
    ]);
    expect((await loadWatchlists()).map((list) => list.id)).toEqual(['a1', 'b2']);
    await reorderWatchlists(['b2']);
    expect((await loadWatchlists()).map((list) => list.id)).toEqual(['b2', 'a1']);
    await deleteWatchlist('b2');
    expect(await loadWatchlists()).toEqual([full()]);
  });

  it("keeps the demo's lists apart, in this browser only", async () => {
    await saveWatchlist(full(), true);
    expect(await loadWatchlists()).toEqual([]);
    expect(await loadWatchlists(true)).toEqual([full()]);
    expect(await browser.storage.sync.get(null)).toEqual({});
  });

  it('tells about every change', async () => {
    const seen: string[][] = [];
    const stop = watchWatchlists((lists) => seen.push(lists.map((list) => list.name)));
    await saveWatchlist(full());
    await new Promise((resolve) => setTimeout(resolve, 10));
    stop();
    expect(seen.at(-1)).toEqual(['IAE']);
  });
});

describe('a dismissed reminder (#469)', () => {
  it('is stored with its watchlist', async () => {
    const list = { ...full(), reminderDone: NOW + 86_400_000 };
    await saveWatchlist(list);
    const [read] = await loadWatchlists();
    expect(read?.reminderDone).toBe(NOW + 86_400_000);
    expect(encodeWatchlist(full())).not.toHaveProperty('x');
  });
});

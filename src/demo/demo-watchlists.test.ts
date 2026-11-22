import { describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storeChangesOf } from '@/watchlists/watch-store-changes';
import { dueReminders, isStoreItem, presenceOf } from '@/watchlists/watchlists';
import { loadWatchlists } from '@/watchlists/watchlists-storage';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo } from './demo';
import { demoWatchlists, DEMO_FILLER_WATCHLIST, seedDemoWatchlists } from './demo-watchlists';

/* The demo's watchlists (#474): every case of the watchlists, made of the demo only. */

const NOW = Date.parse('2026-11-22T12:00:00Z');
const demo = generatedDemo(FALLBACK_CATALOG, 'key-a', '2026-11-22', NOW);
const buyable = FALLBACK_CATALOG.ships.map((ship, index) => ({
  shipId: ship.id,
  skuId: 1000 + index,
  title: ship.name,
  price: ship.msrp,
}));
const made = demoWatchlists({
  hangar: demo.pledges,
  buyback: demo.buyback,
  ships: FALLBACK_CATALOG.ships,
  items: FALLBACK_CATALOG.items,
  buyable,
  now: NOW,
  locale: 'en',
});
const lists = made.lists;

describe('the demo’s watchlists (#474)', () => {
  it('have dates with and without reminder, none, and an empty one', () => {
    expect(lists.some((list) => list.dueAt !== undefined && list.reminder)).toBe(true);
    expect(lists.some((list) => list.dueAt !== undefined && !list.reminder)).toBe(true);
    expect(lists.some((list) => list.dueAt === undefined)).toBe(true);
    expect(lists.some((list) => !list.items.length)).toBe(true);
  });

  it('hold items of every kind, a store item more than once and one no longer in the hangar', () => {
    const kinds = new Set(lists.flatMap((list) => list.items.map((item) => item.kind)));
    expect([...kinds].sort()).toEqual(['buyback', 'hangar', 'storeCcu', 'storePaint', 'storeShip']);
    const items = lists.flatMap((list) => list.items);
    expect(items.some((item) => isStoreItem(item) && (item.count ?? 1) > 1)).toBe(true);
    const known = {
      hangar: { pledges: demo.pledges, updatedAt: NOW },
      buyback: { pledges: demo.buyback, updatedAt: NOW },
    };
    expect(items.some((item) => presenceOf(item, known).state === 'gone')).toBe(true);
  });

  it('remind in the sidebar and tell store changes there', () => {
    expect(dueReminders(lists, NOW).length).toBeGreaterThan(0);
    const catalog = { ships: FALLBACK_CATALOG.ships, buyable, items: FALLBACK_CATALOG.items };
    const kinds = storeChangesOf(lists, catalog, made.seen).changed.flatMap((entry) =>
      entry.changes.map((change) => change.kind),
    );
    expect(kinds).toEqual(expect.arrayContaining(['price', 'back']));
  });

  it('have the filler paints’ watchlist of the Paint Discount Consultant', () => {
    expect(lists.find((list) => list.id === DEMO_FILLER_WATCHLIST)).toMatchObject({
      reminder: true,
    });
  });

  it('are made once per demo key, in the demo’s own storage', async () => {
    fakeBrowser.reset();
    await seedDemoWatchlists('k1', made);
    await seedDemoWatchlists('k1', { lists: [], seen: {} });
    expect((await loadWatchlists(true)).length).toBe(lists.length);
    expect(await loadWatchlists(false)).toEqual([]);
  });
});

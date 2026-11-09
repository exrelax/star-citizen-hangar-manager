import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { STORE_ITEMS } from '@/config';
import { fetchStoreItems, parseSearchAnswer } from './fetch-store-items';
import { toStoreItem, type ApiStoreSku } from './store-items';
import { storeItemsItem, storeItemsMeta } from './store-items-storage';
import { settingsItem } from '@/settings/settings';
import { maybeRefreshStoreItems, refreshStoreItems } from './sync-store-items';

const sku = (id: number, overrides: Partial<ApiStoreSku> = {}): ApiStoreSku => ({
  id: String(id),
  name: `Item ${id}`,
  url: `/pledge/item-${id}`,
  media: { thumbnail: { storeSmall: `https://media/${id}.jpg` } },
  nativePrice: { amount: 6000, discounted: null },
  stock: { available: true },
  isWarbond: false,
  ...overrides,
});

describe('toStoreItem', () => {
  it('takes the price without taxes in USD, the image and the link', () => {
    expect(toStoreItem(sku(199, { name: 'Avenger Stalker ' }), 'Standalone Ships')).toEqual({
      id: 199,
      name: 'Avenger Stalker',
      category: 'Standalone Ships',
      price: 60,
      isWarbond: false,
      available: true,
      image: 'https://media/199.jpg',
      link: '/pledge/item-199',
    });
  });

  it('keeps a discount, the warbond flag and the stock', () => {
    const item = toStoreItem(
      sku(1, {
        nativePrice: { amount: 30000, discounted: 27000 },
        isWarbond: true,
        stock: { available: false },
      }),
      'Standalone Ships',
    );
    expect(item).toMatchObject({
      price: 300,
      discountedPrice: 270,
      isWarbond: true,
      available: false,
    });
  });

  it('skips SKUs without name or price', () => {
    expect(toStoreItem(sku(1, { name: null, title: null }), 'Gear')).toBeUndefined();
    expect(toStoreItem(sku(1, { nativePrice: null }), 'Gear')).toBeUndefined();
  });
});

describe('parseSearchAnswer', () => {
  it('reads the SKUs and their total, and fails on errors', () => {
    expect(
      parseSearchAnswer({ data: { store: { listing: { totalCount: 2, resources: [sku(1)] } } } }),
    ).toEqual({ total: 2, skus: [sku(1)] });
    expect(() => parseSearchAnswer({ errors: [{ message: 'denied' }] })).toThrow('denied');
  });
});

describe('fetchStoreItems', () => {
  it('reads every page of every product and lists each SKU once', async () => {
    const paints = STORE_ITEMS.products.find((product) => product.name === 'Paints')!;
    const ships = STORE_ITEMS.products.find((product) => product.name === 'Standalone Ships')!;
    const fetch = vi.fn(async (product: number, page: number) => {
      if (product === paints.id) {
        return { total: 150, skus: page === 1 ? [sku(1), sku(2)] : [sku(3)] };
      }
      // The same SKU listed in another product too.
      return product === ships.id ? { total: 1, skus: [sku(2)] } : { total: 0, skus: [] };
    });
    const { items, requests } = await fetchStoreItems(fetch);

    expect(requests).toBe(STORE_ITEMS.products.length + 1);
    expect(fetch).toHaveBeenCalledWith(paints.id, 2);
    expect(items.map((item) => [item.id, item.category])).toEqual(
      expect.arrayContaining([
        [1, 'Paints'],
        [3, 'Paints'],
        // Ships come before paints in the products: its first listing counts.
        [2, 'Standalone Ships'],
      ]),
    );
    expect(items).toHaveLength(3);
  });
});

describe('refreshStoreItems', () => {
  beforeEach(() => fakeBrowser.reset());

  const read = (ids: number[]) => async () => ({
    items: ids.map((id) => toStoreItem(sku(id), 'Gear')!),
    requests: 1,
  });

  it('stores the items and does not rewrite an unchanged answer', async () => {
    await refreshStoreItems({ fetchItems: read([1, 2]), now: () => 1000 });
    expect((await storeItemsItem.getValue())?.items).toHaveLength(2);
    expect(await storeItemsMeta.getValue()).toMatchObject({ syncedAt: 1000, updatedAt: 1000 });

    const setValue = vi.spyOn(storeItemsItem, 'setValue');
    await refreshStoreItems({ fetchItems: read([1, 2]), now: () => 2000 });
    expect(setValue).not.toHaveBeenCalled();
    expect(await storeItemsMeta.getValue()).toMatchObject({ syncedAt: 2000, updatedAt: 1000 });
  });

  it('reads again only once the stored items are too old', async () => {
    const fetchItems = vi.fn(read([1]));
    await refreshStoreItems({ fetchItems, now: () => 1000 });
    await refreshStoreItems({ fetchItems, maxAgeMs: 5000, now: () => 3000 });
    expect(fetchItems).toHaveBeenCalledTimes(1);
    await refreshStoreItems({ fetchItems, maxAgeMs: 5000, now: () => 7000 });
    expect(fetchItems).toHaveBeenCalledTimes(2);
  });
});

describe('maybeRefreshStoreItems', () => {
  beforeEach(() => fakeBrowser.reset());
  const MINUTE = 60_000;
  const fetchItems = () =>
    vi.fn(async () => ({ items: [toStoreItem(sku(1), 'Gear')!], requests: 1 }));

  it('reads at the fixed minutes of the hour only', async () => {
    const read = fetchItems();
    const at = (minutes: number) => () => new Date(2026, 10, 9, 12, minutes).getTime();
    await maybeRefreshStoreItems({ fetchItems: read, now: at(1) });
    await maybeRefreshStoreItems({ fetchItems: read, now: at(4) });
    expect(read).toHaveBeenCalledTimes(1);
    await maybeRefreshStoreItems({ fetchItems: read, now: at(5) });
    expect(read).toHaveBeenCalledTimes(2);
    // 12:10 and 12:30 were missed: read once, not twice.
    await maybeRefreshStoreItems({ fetchItems: read, now: at(31) });
    await maybeRefreshStoreItems({ fetchItems: read, now: at(34) });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('reads once a day with smart updates off', async () => {
    const read = fetchItems();
    await settingsItem.setValue({ smartUpdates: false });
    await maybeRefreshStoreItems({ fetchItems: read, now: () => 0 });
    await maybeRefreshStoreItems({ fetchItems: read, now: () => 60 * MINUTE });
    expect(read).toHaveBeenCalledTimes(1);
    await maybeRefreshStoreItems({
      fetchItems: read,
      now: () => STORE_ITEMS.maxAgeWithoutSmartUpdatesMs,
    });
    expect(read).toHaveBeenCalledTimes(2);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { notificationsItem } from '@/notifications/notifications';
import { settingsItem } from '@/settings/settings';
import type { StoreItem } from './items/store-items';
import {
  noteStoreItemChanges,
  noteWarbondChanges,
  shortList,
  storeItemsNote,
  warbondNote,
  watchStoreNoteKinds,
} from './store-change-notes';

beforeEach(() => fakeBrowser.reset());

const ships = [
  { id: 1, name: 'Zeus MR', msrp: 190 },
  { id: 2, name: 'Cutlass Black', msrp: 110 },
  { id: 3, name: 'Aurora Mk I CL', msrp: 45 },
];
const warbond = (shipId: number, price: number) => ({ shipId, skuId: shipId * 10, price });
const item = (id: number, name: string, price: number, discountedPrice?: number): StoreItem => ({
  id,
  name,
  category: 'Gear',
  price,
  ...(discountedPrice !== undefined && { discountedPrice }),
  isWarbond: false,
  available: true,
});

describe('shortList', () => {
  it('cuts long lists off', () => {
    expect(shortList(['A', 'B'], 'en')).toBe('A, B');
    expect(shortList(['A', 'B', 'C', 'D', 'E'], 'en')).toBe('A, B, C … and 2 more');
  });
});

describe('warbondNote', () => {
  it('names the new and the gone warbond CCUs, new ones also for the browser', () => {
    const note = warbondNote([warbond(3, 40)], [warbond(1, 170), warbond(2, 100)], ships, 'en', 5);
    expect(note).toMatchObject({
      id: 'warbonds:5',
      kind: 'warbonds',
      text: 'New warbond CCUs: Zeus MR ($170), Cutlass Black ($100) · Warbond CCUs no longer offered: Aurora Mk I CL ($40)',
      browser: { title: 'New warbond CCUs in the Pledge Store' },
    });
  });

  it('keeps the SKUs of the new ones, for showing it again (#213)', () => {
    const note = warbondNote([warbond(3, 40)], [warbond(1, 170), warbond(2, 100)], ships, 'en', 5);
    expect(note?.subject).toEqual({ warbonds: [10, 20] });
    expect(warbondNote([warbond(3, 40)], [], ships, 'en', 5)?.subject).toBeUndefined();
  });

  it('keeps gone ones out of the browser', () => {
    const note = warbondNote([warbond(3, 40)], [], ships, 'en', 5);
    expect(note?.browser).toBeUndefined();
  });

  it('tells nothing on the first read or without changes', () => {
    expect(warbondNote(undefined, [warbond(1, 170)], ships, 'en', 5)).toBeUndefined();
    expect(warbondNote([warbond(1, 170)], [warbond(1, 170)], ships, 'en', 5)).toBeUndefined();
  });
});

describe('storeItemsNote', () => {
  it('counts the changes and lists them', () => {
    const note = storeItemsNote(
      [item(1, 'Helmet', 10), item(2, 'Armor', 20), item(3, 'Paint', 9)],
      [item(1, 'Helmet', 12), item(2, 'Armor', 20, 15), item(4, 'Suit', 8)],
      'en',
      5,
    );
    expect(note).toMatchObject({
      id: 'storeItems:5',
      kind: 'storeItems',
      text: '4 changes in the Pledge Store',
    });
    expect(note?.details).toEqual([
      'New: Suit ($8)',
      'Gone: Paint',
      'New price: Helmet, $10 → $12',
      'On sale: Armor, $20 → $15',
    ]);
    expect(note?.browser).toBeUndefined();
    // What still matters later (#213): new and repriced items at their price now.
    expect(note?.subject?.items).toEqual([
      { id: 4, price: 8 },
      { id: 1, price: 12 },
      { id: 2, price: 15 },
    ]);
  });
});

describe('noteWarbondChanges', () => {
  it('adds the notification once per read', async () => {
    await noteWarbondChanges([], [warbond(1, 170)], ships, 7);
    await noteWarbondChanges([], [warbond(1, 170)], ships, 7);
    expect((await notificationsItem.getValue()).map((note) => note.id)).toEqual(['warbonds:7']);
  });
});

describe('kinds turned off (#197)', () => {
  it('adds no notification of a kind turned off', async () => {
    await settingsItem.setValue({ notificationsOff: ['warbonds'] });
    await noteWarbondChanges([], [warbond(1, 170)], ships, 7);
    await noteStoreItemChanges([], [item(1, 'Helmet', 10)], 7);
    expect((await notificationsItem.getValue()).map((note) => note.id)).toEqual(['storeItems:7']);
  });

  it('checks off the open notifications of a kind once it is turned off', async () => {
    await noteWarbondChanges([], [warbond(1, 170)], ships, 7);
    await noteStoreItemChanges([], [item(1, 'Helmet', 10)], 7);
    watchStoreNoteKinds();
    await settingsItem.setValue({ notificationsOff: ['storeItems'] });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const done = (await notificationsItem.getValue()).filter((note) => note.doneAt !== undefined);
    expect(done.map((note) => note.id)).toEqual(['storeItems:7']);
  });
});

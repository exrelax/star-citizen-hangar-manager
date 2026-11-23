import { describe, expect, it } from 'vitest';
import { LOCAL_COPY, STORAGES } from './registry';
import {
  canReadAgain,
  deleteKindOf,
  groupSums,
  refreshOrder,
  STORAGE_GROUPS,
  storagesOf,
} from './storage-groups';

/* The stored data in groups (#624). */

describe('the groups of the stored data', () => {
  it('give every storage but the settings a group', () => {
    for (const storage of STORAGES) {
      if (storage.kind === 'settings') expect(storage.group).toBeUndefined();
      else expect(STORAGE_GROUPS).toContain(storage.group);
    }
  });

  it('hold the storages by where their data comes from', () => {
    const ids = (group: (typeof STORAGE_GROUPS)[number]) =>
      storagesOf(group).map((storage) => storage.id);
    expect(ids('account')).toEqual(['hangar', 'buyback', 'orders', 'storeCredit']);
    expect(ids('store').sort()).toEqual(
      ['ships', 'shipStatus', 'shipsBuyable', 'shipsWarbonds', 'storeItems'].sort(),
    );
    expect(ids('website').sort()).toEqual(
      [
        'buybackTokenRenewals',
        'events',
        'priceIncreases',
        'shipFacts',
        'shipRemovals',
        'warbondHistorySite',
      ].sort(),
    );
    expect(ids('browser')).toEqual(['warbondHistory']);
    // The paint plans in the synced storage since #635.
    expect(ids('synced')).toEqual(['paintPlan', 'paintHistory', 'watchlists', 'meltMarks']);
  });

  it('can be read again from RSI or the website, but not what was made here or synced', () => {
    expect(STORAGE_GROUPS.filter(canReadAgain)).toEqual(['account', 'store', 'website']);
    expect(STORAGE_GROUPS.map(deleteKindOf)).toEqual([
      'readAgain',
      'readAgain',
      'readAgain',
      'never',
      'synced',
    ]);
  });

  it('never put the synced group into the local copy, which a reset deletes', () => {
    expect(LOCAL_COPY.some((storage) => storage.group === 'synced')).toBe(false);
  });
});

describe('groupSums', () => {
  it('adds up entries and sizes and takes the oldest last check', () => {
    expect(
      groupSums([
        { id: 'hangar', entries: 120, bytes: 50_000, checkedAt: 3_000 },
        { id: 'buyback', entries: 30, bytes: 10_000, checkedAt: 1_000 },
        { id: 'orders', checkedAt: 0 },
      ]),
    ).toEqual({ storages: 3, entries: 150, bytes: 60_000, oldestCheck: 1_000, empty: false });
  });

  it('is empty without anything stored and without a check', () => {
    expect(groupSums([{ id: 'watchlists' }, { id: 'meltMarks', entries: 0, bytes: 0 }])).toEqual({
      storages: 2,
      entries: 0,
      bytes: 0,
      oldestCheck: undefined,
      empty: true,
    });
  });
});

describe('refreshOrder', () => {
  it("reads the upgrade tool's three storages once, the others each", () => {
    expect(
      refreshOrder(['ships', 'shipsBuyable', 'shipsWarbonds', 'shipStatus', 'storeItems']),
    ).toEqual(['ships', 'shipStatus', 'storeItems']);
  });
});

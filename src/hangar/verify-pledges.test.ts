import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { hangarSnapshot } from './hangar-storage';
import type { Pledge } from './pledge';
import {
  changesOf,
  findPledges,
  storeMismatches,
  storedPageOf,
  storedPledges,
  verifyPledges,
} from './verify-pledges';

const pledge = (id: number, overrides: Partial<Pledge> = {}): Pledge => ({
  id,
  name: `Pledge ${id}`,
  title: `Pledge ${id}`,
  value: '$10.00 USD',
  valueUsd: 10,
  configurationValue: '',
  currency: 'Store Credit',
  availability: 'Attributed',
  contains: '',
  isLastAlpha: false,
  isBuybackable: true,
  isGiftable: false,
  isExchangeable: true,
  isUpgradeable: false,
  isUpgraded: false,
  nameReservations: null,
  nameableShips: null,
  items: [{ title: `Ship ${id}`, kind: 'Ship' }],
  ...overrides,
});

/** RSI's list: ids newest first, `size` per page. */
function rsi(list: Pledge[], size = 3) {
  const sorted = [...list].sort((a, b) => b.id - a.id);
  const lastPage = Math.max(1, Math.ceil(sorted.length / size));
  return vi.fn(async (page: number) => ({
    pledges: sorted.slice((page - 1) * size, page * size),
    lastPage,
  }));
}

/** Ids 100 down to 71: ten pages of three. */
const hangar = Array.from({ length: 30 }, (_, index) => pledge(100 - index));
const pageOf = (id: number) => Math.floor((100 - id) / 3) + 1;

describe('findPledges', () => {
  it('reads only the page a pledge was stored on, if it is still there', async () => {
    const fetchPage = rsi(hangar);
    const { found, requests } = await findPledges([85], { fetchPage, pageOf });
    expect(found.get(85)?.id).toBe(85);
    expect(requests).toBe(1);
    expect(fetchPage).toHaveBeenCalledWith(6);
  });

  it('finds a pledge that moved to a later page (new pledges above it)', async () => {
    const fetchPage = rsi([pledge(103), pledge(102), pledge(101), pledge(104), ...hangar]);
    const { found } = await findPledges([85], { fetchPage, pageOf });
    expect(found.get(85)?.id).toBe(85);
  });

  it('finds a pledge that moved to an earlier page (pledges above it gone)', async () => {
    const fetchPage = rsi(hangar.filter((entry) => entry.id < 80 || entry.id > 94));
    const { found } = await findPledges([75], { fetchPage, pageOf });
    expect(found.get(75)?.id).toBe(75);
  });

  it('tells a gone pledge, within a page and between two', async () => {
    const fetchPage = rsi(hangar.filter((entry) => ![85, 88].includes(entry.id)));
    const { found } = await findPledges([85, 88], { fetchPage, pageOf });
    expect(found.has(85)).toBe(true);
    expect(found.get(85)).toBeUndefined();
    expect(found.get(88)).toBeUndefined();
  });

  it('tells a gone pledge past the end of a shorter list', async () => {
    const fetchPage = rsi(hangar.slice(0, 5));
    const { found } = await findPledges([71], { fetchPage, pageOf });
    expect(found.get(71)).toBeUndefined();
  });

  it('throws if a page can not be read', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error('logged out'));
    await expect(findPledges([85], { fetchPage, pageOf })).rejects.toThrow('logged out');
  });

  it('throws if it needs more pages than allowed', async () => {
    const fetchPage = rsi(hangar, 1);
    await expect(findPledges([71], { fetchPage, pageOf: () => 1, maxPages: 3 })).rejects.toThrow();
  });
});

describe('changesOf', () => {
  it('is empty for the same pledge', () => {
    expect(changesOf(pledge(1), pledge(1))).toEqual([]);
  });

  it('names what changed', () => {
    expect(changesOf(pledge(1), undefined)).toEqual(['gone']);
    expect(changesOf(pledge(1), pledge(1, { isExchangeable: false }))).toEqual(['notMeltable']);
    expect(changesOf(pledge(1), pledge(1, { protectedGames: ['SC'] }))).toEqual(['notMeltable']);
    expect(
      changesOf(
        pledge(1),
        pledge(1, {
          title: 'Upgraded',
          value: '$20.00 USD',
          items: [{ title: 'Other ship', kind: 'Ship' }],
        }),
      ),
    ).toEqual(['name', 'value', 'items']);
    expect(changesOf(pledge(1), pledge(1, { isGiftable: true }))).toEqual(['other']);
  });
});

describe('verifyPledges', () => {
  it('matches pledges RSI still lists as stored', async () => {
    const result = await verifyPledges([hangar[2]!, hangar[20]!], {
      fetchPage: rsi(hangar),
      pageOf,
    });
    expect(result.status).toBe('match');
  });

  it('lists every pledge that changed or is gone', async () => {
    const current = hangar
      .filter((entry) => entry.id !== 90)
      .map((entry) => (entry.id === 95 ? { ...entry, title: 'Upgraded' } : entry));
    const result = await verifyPledges([hangar[5]!, hangar[10]!, hangar[20]!], {
      fetchPage: rsi(current),
      pageOf,
    });
    expect(result.status).toBe('mismatch');
    if (result.status !== 'mismatch') return;
    expect(result.mismatches.map(({ id, changes }) => [id, changes])).toEqual([
      [95, ['name']],
      [90, ['gone']],
    ]);
  });
});

describe('stored pledges', () => {
  beforeEach(() => fakeBrowser.reset());

  const store = (pledges: Pledge[]) =>
    hangarSnapshot.setValue({ pledges, updatedAt: '2026-11-01T00:00:00Z' } as never);

  it('reads the stored pledges of the ids, and throws for one not stored', async () => {
    await store([pledge(3), pledge(2), pledge(1)]);
    expect((await storedPledges([1, 3])).map((entry) => entry.id)).toEqual([1, 3]);
    await expect(storedPledges([4])).rejects.toThrow('#4');
  });

  it('stores the fresh versions and drops the gone ones', async () => {
    await store([pledge(3, { category: 'standalone_ship' }), pledge(2), pledge(1)]);
    await storeMismatches([
      { id: 3, stored: pledge(3), fresh: pledge(3, { title: 'New' }), changes: ['name'] },
      { id: 2, stored: pledge(2), changes: ['gone'] },
    ]);
    const pledges = (await hangarSnapshot.getValue())!.pledges;
    expect(pledges.map((entry) => [entry.id, entry.title, entry.category])).toEqual([
      [3, 'New', 'standalone_ship'],
      [1, 'Pledge 1', undefined],
    ]);
  });

  it('pages pledges by their position, newest first', () => {
    const pageOfStored = storedPageOf(hangar);
    expect([100, 91, 90, 71].map(pageOfStored)).toEqual([1, 1, 2, 3]);
  });
});

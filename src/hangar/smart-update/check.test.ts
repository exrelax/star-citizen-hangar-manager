import { describe, expect, it } from 'vitest';
import type { PledgePage } from '../parse-pledges';
import type { Pledge, PledgeItem } from '../pledge';
import { checkHangar, pickSpotPages, spotCheckCoverage } from './check';

const pledge = (id: number, overrides: Partial<Pledge> = {}): Pledge => ({
  id,
  name: `Pledge ${id}`,
  title: `Pledge ${id}`,
  value: '$10.00 USD',
  valueUsd: 10,
  configurationValue: '$0.00 USD',
  currency: 'Store Credit',
  createdAt: '2026-01-01',
  availability: 'Attributed',
  contains: '',
  isLastAlpha: false,
  isBuybackable: true,
  isGiftable: true,
  isExchangeable: true,
  isUpgradeable: false,
  isUpgraded: false,
  nameReservations: [],
  nameableShips: null,
  items: [],
  ...overrides,
});

/** Ids n, n-1, …, 1 – newest first, like RSI. */
const ids = (count: number) => Array.from({ length: count }, (_, index) => (count - index) * 10);

/** Fake RSI hangar: serves the given pledges in pages of 10 and records the requested pages. */
function rsi(pledges: Pledge[]) {
  const sorted = [...pledges].sort((a, b) => b.id - a.id);
  const lastPage = Math.max(1, Math.ceil(sorted.length / 10));
  const requested: number[] = [];
  const fetchPage = async (page: number): Promise<PledgePage> => {
    requested.push(page);
    return { pledges: sorted.slice((page - 1) * 10, page * 10), lastPage };
  };
  return { fetchPage, requested };
}

const ship = (title: string): PledgeItem => ({ title, kind: 'Ship' });

describe('pickSpotPages', () => {
  it('rotates through the middle pages', () => {
    expect(pickSpotPages(0, 6, 2)).toEqual({ pages: [2, 3], nextCursor: 2 });
    expect(pickSpotPages(2, 6, 2)).toEqual({ pages: [4, 5], nextCursor: 0 });
    expect(pickSpotPages(3, 6, 2)).toEqual({ pages: [5, 2], nextCursor: 1 });
  });

  it('has nothing to pick without middle pages', () => {
    expect(pickSpotPages(0, 2, 2).pages).toEqual([]);
    expect(pickSpotPages(0, 3, 2).pages).toEqual([2]);
  });
});

describe('checkHangar', () => {
  it('finds nothing in an unchanged hangar with first, last and spot pages only', async () => {
    const stored = ids(50).map((id) => pledge(id));
    const server = rsi(stored);
    const result = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 0 });

    expect(result.status).toBe('unchanged');
    expect(server.requested.sort()).toEqual([1, 2, 3, 5]);
    expect(result.nextCursor).toBe(2);
  });

  it('adds new pledges at the top', async () => {
    const stored = ids(50).map((id) => pledge(id));
    const server = rsi([pledge(9999), ...stored]);
    const result = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 0 });

    expect(result.status).toBe('updated');
    if (result.status !== 'updated') return;
    expect(result.added.map((p) => p.id)).toEqual([9999]);
    expect(result.removed).toEqual([]);
    expect(result.pledges.map((p) => p.id)).toEqual([9999, ...ids(50)]);
  });

  it('locates a pledge removed deep in the hangar by binary search', async () => {
    const stored = ids(200).map((id) => pledge(id));
    const gone = stored[124]!; // page 13 of 20
    const server = rsi(stored.filter((p) => p !== gone));
    const result = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 0 });

    expect(result.status).toBe('updated');
    if (result.status !== 'updated') return;
    expect(result.removed.map((p) => p.id)).toEqual([gone.id]);
    expect(result.pledges).toHaveLength(199);
    // First, last and 2 spot pages, plus a few for the binary search – far from all 20.
    expect(server.requested.length).toBeLessThanOrEqual(10);
  });

  it('finds several removals in different places', async () => {
    const stored = ids(200).map((id) => pledge(id));
    const gone = [stored[3]!, stored[57]!, stored[143]!];
    const server = rsi(stored.filter((p) => !gone.includes(p)));
    const result = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 0 });

    expect(result.status).toBe('updated');
    if (result.status !== 'updated') return;
    expect(result.removed.map((p) => p.id).sort()).toEqual(gone.map((p) => p.id).sort());
  });

  it('notices a removal plus an older addition once a spot page lies in between', async () => {
    const stored = ids(100).map((id) => pledge(id));
    const gone = stored[35]!; // page 4
    const older = pledge(stored[64]!.id - 5); // between pages 7 and 8
    const server = rsi([...stored.filter((p) => p !== gone), older]);

    // Spot pages 2 and 3: the shifted range (pages 4–7) is not touched, the count is the same.
    const missed = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 0 });
    expect(missed.status).toBe('unchanged');

    // Spot pages 5 and 6 lie in the shifted range, which reveals both changes.
    const found = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 3 });
    expect(found.status).toBe('updated');
    if (found.status !== 'updated') return;
    expect(found.removed.map((p) => p.id)).toEqual([gone.id]);
    expect(found.added.map((p) => p.id)).toEqual([older.id]);
  });

  it('detects a new game access lock, but not pledges stored before locks were read', async () => {
    // Stored by a version that didn't read the locks: the field is missing.
    const stored = ids(30).map((id) => pledge(id));
    const server = rsi(
      stored.map((p, index) =>
        index === 2 ? { ...p, protectedGames: ['SC' as const] } : { ...p, protectedGames: [] },
      ),
    );
    const result = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 0 });

    expect(result.status).toBe('updated');
    if (result.status !== 'updated') return;
    expect(result.changed.map((p) => p.id)).toEqual([stored[2]!.id]);
    expect(result.pledges[2]!.protectedGames).toEqual(['SC']);
  });

  it('detects changed content of a pledge with the same id', async () => {
    const stored = ids(30).map((id) => pledge(id));
    const server = rsi(stored.map((p, index) => (index === 2 ? { ...p, isGiftable: false } : p)));
    const result = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 0 });

    expect(result.status).toBe('updated');
    if (result.status !== 'updated') return;
    expect(result.changed.map((p) => p.id)).toEqual([stored[2]!.id]);
    expect(result.pledges[2]!.isGiftable).toBe(false);
  });

  it('refreshes the upgraded pledge when a CCU was applied', async () => {
    const ccu = pledge(5000, {
      title: 'Upgrade - Aurora MR to Avenger Titan',
      upgrade: {
        matchItems: [{ id: 1, name: 'Aurora MR' }],
        targetItems: [{ id: 2, name: 'Avenger Titan' }],
        type: 'R',
      },
    });
    const aurora = pledge(150, { title: 'Package - Aurora MR', items: [ship('Aurora MR')] });
    const stored = [ccu, ...ids(100).map((id) => (id === 150 ? aurora : pledge(id)))];
    const upgraded = {
      ...aurora,
      title: 'Package - Aurora MR Upgrades',
      isUpgraded: true,
      items: [ship('Avenger Titan')],
    };
    const server = rsi(stored.filter((p) => p !== ccu).map((p) => (p === aurora ? upgraded : p)));
    const result = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 0 });

    expect(result.status).toBe('updated');
    if (result.status !== 'updated') return;
    expect(result.removed.map((p) => p.id)).toEqual([5000]);
    expect(result.changed.map((p) => p.title)).toEqual(['Package - Aurora MR Upgrades']);
  });

  it('keeps category and CCU image on refreshed pledges', async () => {
    const stored = [
      pledge(30, { category: 'standalone_ship' }),
      pledge(20, {
        upgrade: { matchItems: [], targetItems: [], type: 'R', targetImage: 'target.jpg' },
      }),
    ];
    const server = rsi(stored.map((p) => ({ ...p, category: undefined, isGiftable: false })));
    const result = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 0 });

    expect(result.status).toBe('updated');
    if (result.status !== 'updated') return;
    expect(result.pledges[0]!.category).toBe('standalone_ship');
    expect(result.pledges[1]!.upgrade?.targetImage).toBe('target.jpg');
  });

  it('asks for a full sync when locating the changes would need too many pages', async () => {
    const stored = ids(200).map((id) => pledge(id));
    const server = rsi(stored.filter((_, index) => index % 17 !== 5));
    const result = await checkHangar(stored, {
      fetchPage: server.fetchPage,
      cursor: 0,
      maxRepairPages: 2,
    });
    expect(result.status).toBe('needsFullSync');
  });

  it('handles a hangar that fits on one page', async () => {
    const stored = ids(4).map((id) => pledge(id));
    const server = rsi(stored.slice(1));
    const result = await checkHangar(stored, { fetchPage: server.fetchPage, cursor: 0 });

    expect(server.requested).toEqual([1]);
    expect(result.status).toBe('updated');
    if (result.status !== 'updated') return;
    expect(result.removed.map((p) => p.id)).toEqual([stored[0]!.id]);
  });
});

describe('spotCheckCoverage', () => {
  it('counts the first, the last and the spot check pages', () => {
    expect(spotCheckCoverage(99, 2)).toEqual({
      pages: 99,
      checked: 4,
      share: 4 / 99,
      checksToCoverAll: 49,
    });
    expect(spotCheckCoverage(99, 10).checksToCoverAll).toBe(10);
  });

  it('covers small lists in one check', () => {
    expect(spotCheckCoverage(1, 2)).toMatchObject({ checked: 1, share: 1, checksToCoverAll: 1 });
    expect(spotCheckCoverage(4, 10)).toMatchObject({ checked: 4, share: 1, checksToCoverAll: 1 });
  });
});

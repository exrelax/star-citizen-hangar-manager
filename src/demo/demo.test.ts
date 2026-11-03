import { describe, expect, it } from 'vitest';
import type { BuybackView } from '@/buyback/buyback-view';
import { DEMO } from '@/config';
import type { PledgeView } from '@/hangar/pledge-view';
import { matchesSearch, parseSearchQuery } from '@/hangar/search';
import { createFakeIds, demoBuyback, demoHangar, pickDemo } from './demo';

const KEY = 'test-key';

const pledge = (id: number, overrides: Partial<PledgeView> = {}): PledgeView =>
  ({
    id,
    title: 'Test Pledge',
    ships: [],
    items: [],
    isUpgraded: false,
    page: 1,
    searchText: `test pledge ${id}`,
    ...overrides,
  }) as PledgeView;

// RSI's order: newest (highest id) first.
const hangar = Array.from({ length: 300 }, (_, index) => pledge(100_000_000 - index));

describe('createFakeIds', () => {
  it('makes up stable ids of digits and letters that are never numeric', () => {
    const fakeId = createFakeIds(KEY);
    const ids = hangar.map((entry) => fakeId(entry.id));
    expect(ids.every((id) => /^[0-9A-Z]{9}$/.test(id) && /[A-Z]/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(createFakeIds(KEY)(hangar[0]!.id)).toBe(ids[0]);
    // Another key (another browser) gives other ids.
    expect(createFakeIds('other-key')(hangar[0]!.id)).not.toBe(ids[0]);
  });
});

describe('pickDemo', () => {
  it('picks a fixed selection plus the required entries, in the original order', () => {
    const required = (entry: PledgeView) => entry.id === hangar[299]!.id;
    const picked = pickDemo(hangar, 20, KEY, required);
    expect(picked).toHaveLength(20);
    expect(picked).toContain(hangar[299]);
    expect(picked.map((entry) => entry.id)).toEqual(
      [...picked].map((entry) => entry.id).sort((a, b) => b - a),
    );
    expect(pickDemo(hangar, 20, KEY, required)).toEqual(picked);
  });
});

describe('demoHangar', () => {
  const polaris = pledge(99_999_000, { items: [{ title: 'Polaris', kind: 'Ship' }] });
  const upgraded = Array.from({ length: 10 }, (_, index) =>
    pledge(99_998_000 - index, { isUpgraded: true }),
  );
  const demo = demoHangar([...hangar, polaris, ...upgraded], KEY);

  it('shows the configured number of pledges with the Polaris and some upgraded ones', () => {
    expect(demo).toHaveLength(DEMO.hangarPledges);
    expect(demo.some((entry) => entry.id === polaris.id)).toBe(true);
    expect(demo.filter((entry) => entry.isUpgraded).length).toBeGreaterThanOrEqual(
      DEMO.upgradedPledges,
    );
  });

  it('shows made-up ids and finds pledges by them, not by the real ones', () => {
    const [first] = demo;
    expect(first!.displayId).toMatch(/^[0-9A-Z]{9}$/);
    expect(matchesSearch(first!.searchText, parseSearchQuery(first!.displayId!))).toBe(true);
    expect(matchesSearch(first!.searchText, parseSearchQuery(String(first!.id)))).toBe(false);
  });

  it('replaces the order ids, too', () => {
    const withOrder = pledge(99_997_000, {
      items: [{ title: 'Polaris', kind: 'Ship' }],
      order: { id: 'J4SHJM5S2GUF5', amount: '$1.00 USD', buyback: false },
    });
    const [demoPledge] = demoHangar([withOrder], KEY);
    expect(demoPledge!.order!.id).toMatch(/^[0-9A-Z]{9}$/);
    expect(demoPledge!.order!.id).not.toBe('J4SHJM5S2GUF5');
    expect(demoPledge!.searchText).not.toContain('j4shjm5s2guf5');
  });

  it('numbers the pages of the demo list', () => {
    expect(demo[0]!.page).toBe(1);
    expect(demo[10]!.page).toBe(2);
  });
});

describe('demoBuyback', () => {
  it('shows the configured number of pledges with made-up ids and demo positions', () => {
    const buyback = hangar.map(
      (entry) => ({ ...entry, position: 0, page: 1 }) as unknown as BuybackView,
    );
    const demo = demoBuyback(buyback, KEY);
    expect(demo).toHaveLength(DEMO.buybackPledges);
    expect(demo.map((entry) => entry.position)).toEqual(demo.map((_, index) => index));
    expect(
      demo.every((entry) => entry.displayId && !entry.searchText.includes(String(entry.id))),
    ).toBe(true);
  });
});

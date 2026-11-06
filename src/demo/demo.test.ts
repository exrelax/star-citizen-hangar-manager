import { describe, expect, it } from 'vitest';
import type { BuybackView } from '@/buyback/buyback-view';
import { DEMO } from '@/config';
import type { PledgeView } from '@/hangar/pledge-view';
import { matchesSearch, parseSearchQuery } from '@/hangar/search';
import { refundWindow } from '@/orders/refund';
import { createFakeIds, demoBuyback, demoHangar, demoUpgradeLog, pickDemo } from './demo';

const KEY = 'test-key';

const pledge = (id: number, overrides: Partial<PledgeView> = {}): PledgeView =>
  ({
    id,
    title: 'Test Pledge',
    ships: [],
    items: [],
    isUpgraded: false,
    protectedGames: [],
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
  const gameAccess = pledge(99_997_000, { protectedGames: ['SC', 'SQ42'] });
  const demo = demoHangar([...hangar, polaris, ...upgraded, gameAccess], KEY);

  it('shows the configured number of pledges with the Polaris, the game access and upgrades', () => {
    expect(demo).toHaveLength(DEMO.hangarPledges);
    expect(demo.some((entry) => entry.id === polaris.id)).toBe(true);
    expect(demo.some((entry) => entry.id === gameAccess.id)).toBe(true);
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

  it('gives the first two pledges with an order recent purchase dates for the refund tags', () => {
    const order = { amount: '$10.00 USD', placedAt: '2020-01-01', buyback: false };
    const withOrders = [
      pledge(99_996_003, { order: { ...order, id: 'A' } }),
      pledge(99_996_002, { order: { ...order, id: 'B' } }),
      pledge(99_996_001, { order: { ...order, id: 'C' } }),
    ];
    const demo = demoHangar(withOrders, KEY, '2026-11-03');
    const today = '2026-11-03';
    expect(demo.map((entry) => refundWindow(entry.order!.placedAt!, today)?.daysLeft)).toEqual([
      20,
      3,
      undefined,
    ]);
    expect(demo[0]!.createdAt).toBe(demo[0]!.order!.placedAt);
  });

  it('makes up purchase dates, newest first and nothing of the real ones', () => {
    const today = '2026-11-03';
    const real = hangar.map((entry) => ({ ...entry, createdAt: '2015-06-01' }));
    const dates = demoHangar(real, KEY, today).map((entry) => entry.createdAt!);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(dates.every((date) => date >= DEMO.earliestDate && date <= today)).toBe(true);
    expect(new Set(dates).size).toBeGreaterThan(dates.length / 2);
    expect(dates).not.toContain('2015-06-01');
    // Another key (another browser) gives other dates.
    expect(demoHangar(real, 'other-key', today).map((entry) => entry.createdAt)).not.toEqual(dates);
  });

  it('dates the other money-paid pledges before the refund period, the list stays sorted', () => {
    const today = '2026-11-03';
    const order = { amount: '$10.00 USD', placedAt: '2020-01-01', buyback: false };
    const pledges = hangar.map((entry, index) =>
      index % 7 === 3 ? { ...entry, order: { ...order, id: `O${index}` } } : entry,
    );
    const demo = demoHangar(pledges, KEY, today);
    const days = demo
      .filter((entry) => entry.order)
      .map((entry) => refundWindow(entry.order!.placedAt!, today)?.daysLeft);
    expect(days.slice(0, 2)).toEqual([20, 3]);
    expect(days.slice(2).every((left) => left === undefined)).toBe(true);
    const dates = demo.map((entry) => entry.createdAt!);
    expect(dates).toEqual([...dates].sort().reverse());
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

describe('demoUpgradeLog', () => {
  const entries = [
    { appliedAt: '2016-03-01 10:00', ccuId: 1, name: 'Upgrade - A to B', valueAfter: 100 },
    { appliedAt: '2018-05-02 11:00', ccuId: 2, name: 'Upgrade - B to C', valueAfter: 150 },
    { appliedAt: '2021-07-03 12:00', ccuId: 3, name: 'Upgrade - C to D', valueAfter: 200 },
  ];

  // Noon of 2026-11-03 in local time (the CCU times are shown without a time zone).
  const now = new Date(2026, 10, 3, 12, 0).getTime();

  it('dates the applied CCUs after the purchase, in their order, before now', () => {
    const log = demoUpgradeLog(entries, 42, '2026-10-25', KEY, now);
    const dates = log.map((entry) => entry.appliedAt);
    expect(dates).toEqual([...dates].sort());
    expect(dates.every((date) => date >= '2026-10-25 00:00' && date <= '2026-11-03 12:00')).toBe(
      true,
    );
    expect(dates.every((date) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(date))).toBe(true);
    // Everything but the dates stays, in RSI's order.
    expect(log.map((entry) => ({ ...entry, appliedAt: '' }))).toEqual(
      entries.map((entry) => ({ ...entry, appliedAt: '' })),
    );
  });

  it('works on the day of purchase, too', () => {
    const log = demoUpgradeLog(entries, 42, '2026-11-03', KEY, now);
    expect(log.every((entry) => entry.appliedAt.startsWith('2026-11-03'))).toBe(true);
  });
});

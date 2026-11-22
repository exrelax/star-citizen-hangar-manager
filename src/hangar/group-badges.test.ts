import { describe, expect, it } from 'vitest';
import type { BuybackView } from '@/buyback/buyback-view';
import { buybackGroupBadges, extrasNote, meltMarkBadge, pledgeGroupBadges } from './group-badges';
import { groupItems } from './grouping';
import type { PledgeView } from './pledge-view';

const pledge = (overrides: Partial<PledgeView>) =>
  ({
    id: Math.random(),
    title: 'Upgrade - Nova to RAFT',
    isGiftable: true,
    isMeltable: true,
    isUpgraded: false,
    ...overrides,
  }) as PledgeView;
const groupOf = <T>(items: T[]) =>
  groupItems(items, () => ({ key: 'x', extras: {}, giftable: true }))[0]!;
const texts = (badges: { text: string; off?: boolean }[]) =>
  badges.map((badge) => `${badge.text}${badge.off ? ' (off)' : ''}`);

describe('the badges of a group row (#448)', () => {
  it('show Gift and Melt for all, some or none of the items', () => {
    expect(texts(pledgeGroupBadges(groupOf([pledge({}), pledge({})])))).toEqual(['Gift', 'Melt']);
    const some = pledgeGroupBadges(groupOf([pledge({ isGiftable: false }), pledge({})]));
    expect(texts(some)).toEqual(['Some gift', 'Melt']);
    expect(some[0]!.hint).toBe('1 of 2');
    const none = pledgeGroupBadges(
      groupOf([
        pledge({ isGiftable: false, isMeltable: false }),
        pledge({ isGiftable: false, isMeltable: false }),
      ]),
    );
    expect(texts(none)).toEqual(['Gift (off)', 'Melt (off)']);
  });

  it('show an insurance all items share, and upgraded for all or some', () => {
    const lti = { lifetime: true } as const;
    const badges = pledgeGroupBadges(
      groupOf([pledge({ insurance: lti, isUpgraded: true }), pledge({ insurance: lti })]),
    );
    expect(texts(badges)).toEqual(['LTI', 'Some upgraded', 'Gift', 'Melt']);
    expect(badges[0]!.className).toBe('is-insurance is-lti');
    // Different insurances: no badge, the note tells it.
    const mixed = pledgeGroupBadges(
      groupOf([
        pledge({ insurance: lti }),
        pledge({ insurance: { lifetime: false, months: 120 } }),
      ]),
    );
    expect(texts(mixed)).toEqual(['Gift', 'Melt']);
  });

  it('show the buy back’s own labels', () => {
    const item = (overrides: Partial<BuybackView>) =>
      ({ id: Math.random(), title: 'x', isProbablyGiftable: true, ...overrides }) as BuybackView;
    expect(texts(buybackGroupBadges(groupOf([item({}), item({})])))).toEqual(['Probably giftable']);
    expect(
      texts(buybackGroupBadges(groupOf([item({ isProbablyGiftable: false }), item({})]))),
    ).toEqual(['Some probably giftable']);
    expect(texts(buybackGroupBadges(groupOf([item({ isProbablyGiftable: false })])))).toEqual([]);
  });

  it('tell the extras that differ in one note', () => {
    expect(extrasNote(['gear', 'bisPaint', 'insurance'])).toBe(
      'Some with gear, some with BIS paint, different insurance',
    );
    expect(extrasNote([])).toBeUndefined();
  });
});

describe('the labels a group row takes from its items (#487)', () => {
  const coverage = (id: number, base: number, covered = false) => ({
    id,
    baseShip: { id: base, name: base === 7 ? 'Arrow' : 'Marauder' },
    hangar: { ships: [], ccus: [] },
    buyback: { ships: [], ccus: [] },
    covered,
  });
  const always = {
    source: { id: 'wiki', name: 'Star Citizen Wiki', url: 'https://w', facts: [] },
    changedAt: '',
    has: (id: number) => id === 7,
  };
  const ccu = (id: number, placedAt?: string) =>
    pledge({ id, isCcu: true, ...(placedAt && { order: { placedAt } as PledgeView['order'] }) });
  const context = (coverages: ReturnType<typeof coverage>[]) => ({
    coverageOf: (id: number) => coverages.find((c) => c.id === id),
    alwaysAvailable: always,
    ships: [],
    today: '2026-11-20',
    locale: 'en' as const,
  });

  it('shows the CCU Consultant’s labels of all or some items, with the single row’s tooltip', () => {
    const arrow = pledgeGroupBadges(
      groupOf([ccu(1), ccu(2)]),
      context([coverage(1, 7), coverage(2, 7)]),
    );
    expect(texts(arrow)).toEqual(['Base always available', 'Gift', 'Melt']);
    expect(arrow[0]!.hint).toMatch(/^The base ship Arrow is always available/);
    const marauder = pledgeGroupBadges(
      groupOf([ccu(3), ccu(4)]),
      context([coverage(3, 8), coverage(4, 8, true)]),
    );
    expect(texts(marauder)).toEqual(['Some base ship missing', 'Gift', 'Melt']);
    expect(marauder[0]!.hint).toMatch(/1 of 2$/);
  });

  it('shows the refund countdown of the item with the least time left', () => {
    const badges = pledgeGroupBadges(
      groupOf([ccu(5, '2026-11-13'), ccu(6, '2026-10-30'), ccu(7)]),
      context([]),
    );
    // Bought on Oct 30: refundable until Nov 29, 9 days left.
    expect(texts(badges)[0]).toBe('Refund: 9 days');
    expect(badges[0]!.className).toBe('is-refund');
    expect(badges[0]!.hint).toMatch(/2 of 3 items can still be refunded\.$/);
    const last = pledgeGroupBadges(groupOf([ccu(8, '2026-10-21')]), context([]));
    expect(texts(last)[0]).toBe('Refund: last day');
    expect(last[0]!.className).toBe('is-refund is-urgent');
  });
});

describe('the melt label of a group (#552)', () => {
  const NOW = Date.parse('2026-11-22T12:00:00Z');
  const HOUR = 60 * 60 * 1000;
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const marks = (...lefts: number[]) =>
    new Map(
      lefts.map((left, index) => [
        index + 1,
        { pledgeId: index + 1, markedAt: NOW - HOUR, meltableAt: NOW + left },
      ]),
    );

  it('shows nothing without a marked item', () => {
    expect(meltMarkBadge(items, new Map(), NOW, 'en')).toBeUndefined();
  });

  it('shows one time with the count of marked items', () => {
    expect(meltMarkBadge(items, marks(3 * HOUR), NOW, 'en')).toMatchObject({
      text: 'Melt in 3 hr',
      count: '1',
      className: 'is-melt-mark',
      hint: '1 of 4 marked to melt, the first ready in 3 hr.',
    });
  });

  it('shows the earliest and the latest time', () => {
    expect(meltMarkBadge(items, marks(3 * HOUR, 21 * HOUR), NOW, 'en')?.text).toBe(
      'Melt in 3 hr – 21 hr',
    );
  });

  it('shows "Melt now" while some are ready, alone once all are', () => {
    expect(meltMarkBadge(items, marks(-HOUR, 21 * HOUR), NOW, 'en')).toMatchObject({
      text: 'Melt now – 21 hr',
      hint: '2 of 4 marked to melt, 1 of them ready now.',
    });
    expect(meltMarkBadge(items, marks(-HOUR, -2 * HOUR), NOW, 'en')).toMatchObject({
      text: 'Melt now',
      className: 'is-melt-mark is-ready',
      count: '2',
    });
  });
});

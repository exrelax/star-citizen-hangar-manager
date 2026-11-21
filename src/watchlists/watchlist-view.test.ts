import { describe, expect, it } from 'vitest';
import type { WatchItem } from './watchlists';
import { fromLocalInput, searchPlain, toLocalInput, watchSections } from './watchlist-view';

const hangarItem = (pledgeId: number, name = `Pledge ${pledgeId}`): WatchItem => ({
  kind: 'hangar',
  pledgeId,
  name,
  addedAt: 1000,
});
const buybackItem = (pledgeId: number): WatchItem => ({
  kind: 'buyback',
  pledgeId,
  name: `Buy back ${pledgeId}`,
  addedAt: 1000,
});
const paint: WatchItem = {
  kind: 'storePaint',
  skuId: 7,
  name: 'Paint Café',
  addedAt: 1000,
  count: 2,
};

const lists = {
  hangar: {
    pledges: [
      { id: 1, title: 'One' },
      { id: 3, title: 'Three' },
    ],
    updatedAt: 5000,
  },
  buyback: { pledges: [{ id: 2, title: 'Two' }], updatedAt: 5000 },
};

describe('watchSections', () => {
  it('shows the pledges still there as rows, in the watchlist’s order', () => {
    const sections = watchSections(
      [hangarItem(3), hangarItem(1), buybackItem(2)],
      [{ id: 1 }, { id: 3 }],
      [{ id: 2 }],
      lists,
    );
    expect(sections.hangar?.pledges.map((pledge) => pledge.id)).toEqual([3, 1]);
    expect(sections.hangar?.count).toBe(2);
    expect(sections.buyback?.pledges).toEqual([{ id: 2 }]);
    expect(sections.store).toBeUndefined();
  });

  it('keeps a pledge gone as a plain row, with where it is now', () => {
    const sections = watchSections([hangarItem(2)], [{ id: 1 }], [{ id: 2 }], lists);
    expect(sections.hangar?.pledges).toEqual([]);
    expect(sections.hangar?.plain).toEqual([
      expect.objectContaining({ key: 'h:2', presence: { state: 'gone', nowIn: 'buyback' } }),
    ]);
    expect(sections.buyback).toBeUndefined();
  });

  it('shows a pledge as a plain row while its list wasn’t read', () => {
    const sections = watchSections([buybackItem(9)], [], [], { hangar: lists.hangar });
    expect(sections.buyback?.plain[0]?.presence).toEqual({ state: 'unknown' });
  });

  it('puts store items into their own section', () => {
    const sections = watchSections([paint], [], [], lists);
    expect(sections.store).toMatchObject({ count: 1, pledges: [], plain: [{ key: 'p:7' }] });
  });
});

describe('searchPlain', () => {
  const items = watchSections([paint, hangarItem(5, 'Aurora LN')], [], [], lists);
  const plain = [...items.store!.plain, ...items.hangar!.plain];

  it('finds items by the start of their words, without diacritics', () => {
    expect(searchPlain(plain, 'cafe').map((entry) => entry.key)).toEqual(['p:7']);
    expect(searchPlain(plain, 'aur').map((entry) => entry.key)).toEqual(['h:5']);
  });

  it('keeps every item without a search', () => {
    expect(searchPlain(plain, ' ')).toHaveLength(2);
  });
});

describe('the date field', () => {
  it('reads back what it shows', () => {
    const time = new Date(2026, 11, 3, 18, 5).getTime();
    expect(toLocalInput(time)).toBe('2026-12-03T18:05');
    expect(fromLocalInput('2026-12-03T18:05')).toBe(time);
  });

  it('has no time while empty or invalid', () => {
    expect(fromLocalInput('')).toBeUndefined();
    expect(fromLocalInput('tomorrow')).toBeUndefined();
  });
});

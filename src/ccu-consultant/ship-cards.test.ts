import { describe, expect, it } from 'vitest';
import type { ShipRemoval } from '@/ship-removals/ship-removals';
import type { BaseShipList, BaseShipRow } from './base-ship-list';
import type { CoverageMatch } from './coverage';
import { cardSections, groupCcuIds, shipCards, type CardSources } from './ship-cards';

const match = (id: number, kind: 'ship' | 'ccu', source: 'hangar' | 'buyback' = 'buyback') =>
  ({ source, kind, id, title: `Pledge ${id}` }) as CoverageMatch;
const row = (key: string, extra: Partial<BaseShipRow> = {}): BaseShipRow => ({
  key,
  name: key,
  ccus: [],
  matches: [],
  ...extra,
});
const removal: ShipRemoval = {
  ship: { id: 7, name: 'Hawk' },
  removedAt: { at: Date.parse('2027-01-27T00:00:00Z'), dayOnly: true },
  source: 'https://example.com',
};

const sources = (onSale: number[] = []): CardSources => ({
  imageOf: (id) => `https://img/${id}.jpg`,
  skuOf: (base) =>
    base.shipId !== undefined && onSale.includes(base.shipId) ? 1000 + base.shipId : undefined,
  thumbOf: (m) => (m.kind === 'ship' ? `https://thumb/${m.id}.jpg` : undefined),
});

const list = (parts: Partial<BaseShipList>): BaseShipList => ({
  counts: { hangar: 0, buyback: 0, always: 0, missing: 0 },
  total: 0,
  groups: { missing: [], buyback: [], always: [] },
  soon: [],
  soonCount: 0,
  tooFew: [],
  tooFewCount: 0,
  ...parts,
});

describe('shipCards (#563)', () => {
  it('gives a buy back base ship its pledges as thumbnails and the buy back as action', () => {
    const [card] = shipCards(
      [row('Razor', { shipId: 3, ccus: [1, 2], matches: [match(80, 'ship'), match(81, 'ccu')] })],
      'buyback',
      sources([3]),
    );
    expect(card).toMatchObject({
      image: 'https://img/3.jpg',
      onSale: true,
      thumbs: [
        { id: 80, title: 'Pledge 80', image: 'https://thumb/80.jpg' },
        { id: 81, title: 'Pledge 81' },
      ],
      ships: 1,
      ccus: 1,
      action: { kind: 'buyback', ids: [80, 81] },
    });
  });

  it('keeps the action each group has in its table', () => {
    const cards = (
      section: Parameters<typeof shipCards>[1],
      base: BaseShipRow,
      onSale = [] as number[],
    ) => shipCards([base], section, sources(onSale))[0]!.action;
    const store = { kind: 'store', link: '/pledge/ships/x' };
    // Without base ship: its page in the Pledge Store, if known.
    expect(cards('missing', row('A', { shipId: 1, link: '/pledge/ships/x' }), [1])).toEqual(store);
    expect(cards('missing', row('A', { shipId: 1 }))).toBeUndefined();
    // Always available: RSI's ship upgrade dialog while on sale, else the page.
    expect(cards('always', row('B', { shipId: 2, link: '/pledge/ships/x' }), [2])).toEqual({
      kind: 'upgrade',
      skuId: 1002,
    });
    expect(cards('always', row('B', { shipId: 2, link: '/pledge/ships/x' }))).toEqual(store);
    // Leaving: the ship upgrade while on sale, else the ship in the Ship Removals.
    expect(cards('soon', row('Hawk', { shipId: 7, removal }), [7])).toEqual({
      kind: 'upgrade',
      skuId: 1007,
    });
    expect(cards('soon', row('Hawk', { shipId: 7, removal }))).toEqual({
      kind: 'removal',
      shipId: 7,
    });
    expect(cards('tooFew', row('C', { shipId: 4, link: '/pledge/ships/x' }))).toEqual(store);
    // Nothing in the buy back: no action.
    expect(cards('buyback', row('D'))).toBeUndefined();
  });

  it('has no image without a known ship', () => {
    const [card] = shipCards([row('Nox')], 'missing', sources());
    expect(card?.image).toBeUndefined();
    expect(card?.onSale).toBe(false);
  });
});

describe('the sections and CCUs of a group (#563)', () => {
  const cutlass = row('Cutlass', { ccus: [1, 2] });
  const hawk = row('Hawk', { ccus: [2, 3], removal });
  const razor = row('Razor', { ccus: [4] });
  const parts = list({
    groups: { missing: [cutlass], buyback: [razor], always: [] },
    soon: [hawk],
  });

  it('adds the base ships short of ways to "Without base ship"', () => {
    expect(cardSections(parts, 'missing').map((part) => part.section)).toEqual(['missing', 'soon']);
    expect(cardSections(parts, 'buyback').map((part) => part.section)).toEqual(['buyback']);
    // The group's own part even when empty, for its empty state.
    expect(cardSections(parts, 'always')).toEqual([{ section: 'always', rows: [] }]);
  });

  it('counts every CCU of a group once', () => {
    expect(groupCcuIds(parts, 'missing')).toEqual([1, 2, 3]);
    expect(groupCcuIds(parts, 'buyback')).toEqual([4]);
    expect(groupCcuIds(parts, 'always')).toEqual([]);
  });
});

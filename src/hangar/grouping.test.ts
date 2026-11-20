import { describe, expect, it } from 'vitest';
import { toBuybackView } from '@/buyback/buyback-view';
import type { BuybackPledge } from '@/buyback/buyback';
import { buybackFacts, groupItems, isSingle, pledgeFacts } from './grouping';
import type { Pledge, PledgeItem } from './pledge';
import { toPledgeView, type PledgeView } from './pledge-view';

let nextId = 1;
function pledge(title: string, items: PledgeItem[], extra: Partial<Pledge> = {}): PledgeView {
  return toPledgeView({
    id: nextId++,
    name: title,
    title,
    value: '$10.00 USD',
    valueUsd: 10,
    isGiftable: true,
    isExchangeable: true,
    isUpgraded: false,
    items,
    ...extra,
  } as Pledge);
}
const ship = (title: string): PledgeItem => ({ title, kind: 'Ship' });
const insurance = (title: string): PledgeItem => ({ title, kind: 'Insurance' });
function ccu(from: string, to: string, extra: Partial<Pledge> = {}, edition = 'Standard') {
  const title = `Upgrade - ${from} to ${to} ${edition} Edition`;
  return pledge(title, [{ title }], {
    upgrade: {
      matchItems: [{ id: 1, name: from }],
      targetItems: [{ id: 2, name: to }],
      type: 'R',
    },
    ...extra,
  });
}
const groupsOf = (pledges: PledgeView[]) => groupItems(pledges, pledgeFacts);
const ids = (pledges: { id: number }[]) => pledges.map((p) => p.id);

describe('the grouping of "My Hangar" (#446)', () => {
  it('groups CCUs by their base and target ship, any edition', () => {
    const a = ccu('Nova', 'RAFT');
    const b = ccu('Nova', 'RAFT', {}, 'Warbond');
    const c = ccu('Nova', 'Hull A');
    const groups = groupsOf([a, b, c]);
    expect(groups.map((g) => ids(g.items))).toEqual([[a.id, b.id], [c.id]]);
    expect(isSingle(groups[1]!)).toBe(true);
  });

  it('groups ships by the ships they hold, packages also by their name', () => {
    const lti = pledge('Standalone Ships - Cutlass Black - LTI', [
      ship('Cutlass Black'),
      insurance('Lifetime Insurance'),
    ]);
    const tenYears = pledge('Standalone Ships - Cutlass Black - 10 Year', [
      ship('Cutlass Black'),
      insurance('120 Month Insurance'),
    ]);
    const withGear = pledge('Standalone Ships - Cutlass Black', [
      ship('Cutlass Black'),
      { title: 'Cutlass Black - Best in Show 2955 Paint', kind: 'Skin' },
      { title: 'Pembroke Armor', kind: 'FPS Equipment' },
    ]);
    const packA = pledge('Package - Cutlass Black Starter Pack', [
      ship('Cutlass Black'),
      { title: 'Star Citizen Digital Download' },
    ]);
    const packB = pledge('Package - Cutlass Black Explorer Pack', [ship('Cutlass Black')]);
    const groups = groupsOf([lti, tenYears, withGear, packA, packB]);
    expect(groups.map((g) => ids(g.items))).toEqual([
      [lti.id, tenYears.id, withGear.id],
      [packA.id],
      [packB.id],
    ]);
    // What differs among the three ships: added gear, a BIS paint, the insurance.
    expect(groups[0]!.extras).toEqual(['gear', 'bisPaint', 'insurance']);
  });

  it('groups an upgraded pledge by the ship it is now, "upgraded" an extra', () => {
    const upgraded = pledge(
      'Standalone Ships - Aurora MR',
      [ship('Avenger Titan'), insurance('Lifetime Insurance')],
      { isUpgraded: true },
    );
    const titan = pledge('Standalone Ships - Avenger Titan - LTI', [
      ship('Avenger Titan'),
      insurance('Lifetime Insurance'),
    ]);
    const [group] = groupsOf([upgraded, titan]);
    expect(group!.count).toBe(2);
    expect(group!.extras).toEqual(['upgraded']);
  });

  it('groups gear, paints and the rest by their name and kind', () => {
    const paint = (id = '') =>
      pledge(`Paints - Sabre - Ashcloud Paint${id}`, [
        { title: 'Sabre - Ashcloud Paint', kind: 'Skin' },
      ]);
    const armor = pledge('Gear - Pembroke Armor', [
      { title: 'Pembroke Armor', kind: 'FPS Equipment' },
    ]);
    const groups = groupsOf([paint(), armor, paint()]);
    expect(groups.map((g) => g.count)).toEqual([2, 1]);
  });

  it('groups the same item of several years’ events by what it holds', () => {
    const helmet = (title: string) =>
      pledge(title, [{ title: 'Snarling Vanduul Helmet', kind: 'FPS Equipment' }], {
        valueUsd: 0,
        value: '$0.00 USD',
      });
    const skull = pledge('Add-Ons - Holographic Vanduul Skull', [
      { title: 'Holographic Vanduul Skull' },
    ]);
    const groups = groupsOf([
      helmet("Day of the Vara 2956 - 'Snarling Vanduul' Helmet"),
      skull,
      helmet("2953 Day of the Vara - 'Snarling Vanduul' Helmet"),
      helmet("2952 Day of the Vara - 'Snarling Vanduul' Helmet"),
    ]);
    expect(groups.map((g) => g.count)).toEqual([3, 1]);
  });

  it('sums value and discount, and tells giftable and meltable for all, some or none', () => {
    const a = ccu('Nova', 'RAFT', { valueUsd: 10.1, isGiftable: true, isExchangeable: true });
    const b = ccu('Nova', 'RAFT', { valueUsd: 20.2, isGiftable: false, isExchangeable: true });
    const discounted = {
      ...a,
      discount: { original: 15, paid: 10.1, amount: 4.9, percent: 32.67 },
    };
    const [group] = groupItems([discounted as PledgeView, b], pledgeFacts);
    expect(group!.value).toEqual({ total: 30.3, unknown: 0 });
    // One discount isn't known: the sum covers the known one and says so.
    expect(group!.discount).toEqual({ total: 4.9, unknown: 1 });
    expect([group!.giftable, group!.meltable]).toEqual(['some', 'all']);
  });
});

describe('the grouping of "Buy Back" (#446)', () => {
  let id = 1000;
  const view = (pledge: Omit<BuybackPledge, 'id'>, price?: number) => ({
    ...toBuybackView({ id: id++, ...pledge } as BuybackPledge, {
      position: 0,
      ...(price !== undefined && { priceOf: () => ({ amount: price, source: 'rsi' as const }) }),
    }),
  });

  it('groups by the same rules, the buy back price as value', () => {
    const a = view(
      {
        title: 'Upgrade - Nova to RAFT Standard Edition',
        contained: 'Upgrade - Nova to RAFT Standard Edition',
        isUpgrade: true,
      },
      5,
    );
    const b = view({
      title: 'Upgrade - Nova to RAFT Warbond Edition',
      contained: 'Upgrade - Nova to RAFT Warbond Edition',
      isUpgrade: true,
    });
    const shipA = view(
      {
        title: 'Standalone Ships - Cutlass Black - LTI',
        contained: 'Cutlass Black and 2 items',
        items: ['Cutlass Black', 'Lifetime Insurance', 'Hangar Decoration'],
        isUpgrade: false,
        category: 'standalone_ship',
      },
      110,
    );
    const shipB = view(
      {
        title: 'Standalone Ships - Cutlass Black - 10 Year',
        contained: 'Cutlass Black and 1 item',
        items: ['Cutlass Black', '120 Month Insurance'],
        isUpgrade: false,
        category: 'standalone_ship',
      },
      100,
    );
    const paint = view({
      title: 'Paints - Sabre - Ashcloud Paint',
      contained: 'Sabre - Ashcloud Paint',
      isUpgrade: false,
    });
    const groups = groupItems([a, shipA, b, shipB, paint], buybackFacts);
    expect(groups.map((g) => g.count)).toEqual([2, 2, 1]);
    expect(groups[0]!.value).toEqual({ total: 5, unknown: 1 });
    expect(groups[1]!.value).toEqual({ total: 210, unknown: 0 });
    expect(groups[1]!.extras).toEqual(['gear', 'insurance']);
    // Meltable doesn't apply to the buy back.
    expect(groups[0]!.meltable).toBeUndefined();
  });
});

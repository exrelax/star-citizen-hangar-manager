import { describe, expect, it } from 'vitest';
import { ccuCoverage } from '@/ccu-consultant/coverage';
import { standingOf } from '@/ccu-consultant/base-ship-list';
import type { AlwaysAvailableList } from '@/ccu-consultant/always-available';
import { REFUND_URGENT_DAYS } from '@/config';
import { buybackFacts, groupItems, pledgeFacts, type ItemGroup } from '@/hangar/grouping';
import type { PledgeView } from '@/hangar/pledge-view';
import { refundWindow } from '@/orders/refund';
import { demoCatalog } from './catalog';
import { generatedDemo } from './demo';
import { DEMO_ALWAYS_AVAILABLE_BASES } from './demo-groups';

/*
 * The cases of the Grouped View in the default demo (#450): groups of each kind next to single
 * items, differing extras, all, some and none giftable and meltable, sums with a discount and a
 * surcharge, the labels taken from the items (#487), and groups in the buy back.
 */

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const catalog = demoCatalog(undefined, undefined);

describe.each(['any demo key', 'another key', 'k3'])('the grouped view of the demo (%s)', (key) => {
  const { pledges, buyback } = generatedDemo(catalog, key, TODAY, NOW);
  const groups = groupItems(pledges, pledgeFacts);
  const several = groups.filter((group) => group.count > 1);
  const kindOf = (group: ItemGroup<PledgeView>) => group.key.split(':')[0];

  it('has groups of CCUs, ships, packages and gear next to single items', () => {
    expect(groups.some((group) => group.count === 1)).toBe(true);
    expect(several.some((group) => kindOf(group) === 'ccu')).toBe(true);
    expect(several.some((group) => /^ships:[^|]+\|$/.test(group.key))).toBe(true);
    expect(several.some((group) => /^ships:.+\|.+$/.test(group.key))).toBe(true);
    expect(several.some((group) => kindOf(group) === 'item')).toBe(true);
  });

  it('has a group whose extras differ: gear, BIS paint, insurance, upgraded', () => {
    expect(
      several.some((group) =>
        ['gear', 'bisPaint', 'insurance', 'upgraded'].every((extra) =>
          group.extras.includes(extra as never),
        ),
      ),
    ).toBe(true);
  });

  it('has groups all, some and none of whose items are giftable and meltable', () => {
    for (const share of ['all', 'some', 'none'] as const) {
      expect(
        several.some((group) => group.giftable === share),
        `giftable ${share}`,
      ).toBe(true);
      expect(
        several.some((group) => group.meltable === share),
        `meltable ${share}`,
      ).toBe(true);
    }
  });

  it('sums a discount over a group with a surcharge among its items', () => {
    expect(
      several.some(
        (group) =>
          group.discount.total > 0 && group.items.some((item) => (item.discount?.amount ?? 0) < 0),
      ),
    ).toBe(true);
  });

  it('takes "Base ship missing" and "Base always available" for CCU groups from the items', () => {
    const coverage = ccuCoverage({ ships: catalog.ships, hangar: pledges, buyback });
    const always = new Set(
      catalog.ships
        .filter((ship) => DEMO_ALWAYS_AVAILABLE_BASES.includes(ship.name))
        .map((ship) => ship.id),
    );
    const list = { has: (id: number) => always.has(id) } as AlwaysAvailableList;
    const standings = (group: ItemGroup<PledgeView>) =>
      new Set(group.items.map((item) => standingOf(coverage.get(item.id)!, list)));
    const ccuGroups = several.filter((group) => kindOf(group) === 'ccu');
    expect(ccuGroups.some((group) => standings(group).has('missing'))).toBe(true);
    expect(
      ccuGroups.some((group) =>
        group.items.every((item) => always.has(coverage.get(item.id)!.baseShip!.id!)),
      ),
    ).toBe(true);
  });

  it('shows the refund countdown of one item among several and of several, also the last week', () => {
    const daysLeft = (group: ItemGroup<PledgeView>) =>
      group.items.flatMap((item) => {
        const window = item.order?.placedAt && refundWindow(item.order.placedAt, TODAY);
        return window ? [window.daysLeft] : [];
      });
    const one = several.filter((group) => daysLeft(group).length === 1);
    const many = several.filter((group) => new Set(daysLeft(group)).size > 1);
    expect(one.length && many.length).toBeTruthy();
    expect(
      [...one, ...many].some((group) => Math.min(...daysLeft(group)) < REFUND_URGENT_DAYS),
    ).toBe(true);
  });

  it('has groups in the buy back next to single items', () => {
    const buybackGroups = groupItems(buyback, buybackFacts);
    expect(buybackGroups.some((group) => group.count > 1)).toBe(true);
    expect(buybackGroups.some((group) => group.count === 1)).toBe(true);
  });
});

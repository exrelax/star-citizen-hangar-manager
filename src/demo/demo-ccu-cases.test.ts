import { describe, expect, it } from 'vitest';
import { alwaysAvailableList, withoutLeaving } from '@/ccu-consultant/always-available';
import { baseShipList, standingOf } from '@/ccu-consultant/base-ship-list';
import { ccuCoverage, type CcuCoverage } from '@/ccu-consultant/coverage';
import { groupCoverage } from '@/ccu-consultant/group-coverage';
import { missingCounts } from '@/ccu-consultant/use-base-ship-list';
import { buybackFacts, groupItems, pledgeFacts } from '@/hangar/grouping';
import type { PledgeView } from '@/hangar/pledge-view';
import { isWithinDays } from '@/price-increases/price-increases';
import { DEFAULT_SETTINGS } from '@/settings/settings';
import { obtainableRemovals } from '@/ship-removals/removal-availability';
import { createShipFactsLookup } from '@/ships/ship-facts';
import { bundledShipFacts } from '@/ships/sync-ship-facts';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo } from './demo';
import { ccuCaseBasesOf } from './demo-ccu-cases';
import { missingBaseOf } from './demo-groups';
import { DEFAULT_DEMO_SETTINGS, type DemoSettings } from './demo-settings';
import { demoShipRemovals } from './demo-ship-removals';

/*
 * The CCU Consultant's cases in the demo (#425): every group and every kind of base ship coverage
 * on each demo hangar, the sections "Soon without base ship" (#454) and "Discount at risk" (#455),
 * and the demo settings that empty them.
 */

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const facts = createShipFactsLookup(bundledShipFacts()!);
// The bundled catalog with two more ships the bundled facts call always available (by their ids).
const catalog = {
  ...FALLBACK_CATALOG,
  ships: [
    ...FALLBACK_CATALOG.ships,
    { id: 7, name: '300i', msrp: 75 },
    { id: 84, name: 'Hull A', msrp: 90 },
  ],
};

function consultant(key: string, demo: Partial<DemoSettings> = {}) {
  const settings = { ...DEFAULT_DEMO_SETTINGS, ...demo };
  const result = generatedDemo(catalog, key, TODAY, NOW, settings);
  const { pledges, buyback, account } = result;
  const bases = ccuCaseBasesOf(account.pledges, catalog);
  const { removals, onSale } = demoShipRemovals({
    ships: catalog.ships,
    hangar: pledges,
    buyback,
    warbondShips: new Set(),
    avoid: new Set(),
    ccuCases: {
      leaving: bases.leaving?.id,
      covered: bases.buyback?.id,
      stay: [
        ...[bases.always, bases.unavailable, bases.covered, bases.partial].flatMap((ship) =>
          ship ? [ship.id] : [],
        ),
        ...[missingBaseOf(account.pledges)].filter((id) => id !== undefined),
      ],
    },
    now: NOW,
  });
  const leaving = obtainableRemovals({
    removals,
    onSale,
    alwaysAvailable: (id) => facts.isAlwaysAvailable(id),
  });
  const always = withoutLeaving(alwaysAvailableList(DEFAULT_SETTINGS, facts), leaving);
  const coverage = ccuCoverage({ ships: catalog.ships, hangar: pledges, buyback });
  const list = baseShipList(coverage.values(), always, catalog.ships, leaving);
  return { ...result, bases, coverage, always, list };
}

/** The buy back's CCU groups of a demo (#575): covered and total of the group from a base ship. */
function groupCoverages(key: string) {
  const { buyback, pledges } = consultant(key);
  const coverage = ccuCoverage({ ships: catalog.ships, hangar: pledges, buyback }, 'buyback');
  const groups = groupItems(
    buyback.filter((pledge) => pledge.isCcu),
    buybackFacts,
  ).filter((group) => group.count > 1);
  return {
    buyback: (base: number | undefined) => {
      const group = groups.find((entry) => entry.items[0]!.upgrade?.fromShipId === base);
      const found =
        group &&
        groupCoverage(
          group.items.map((item) => item.id),
          coverage,
        );
      return found && [found.covered, found.total];
    },
  };
}

describe.each(['any demo key', 'another key', 'k3'])('the CCU Consultant in the demo %s', (key) => {
  const { pledges, buyback, bases, coverage, always, list, account } = consultant(key);
  const byId = new Map(pledges.map((pledge) => [pledge.id, pledge]));
  const covers = [...coverage.values()];
  const viewsOf = (ids: readonly number[]) => ids.map((id) => byId.get(id)!);

  it('has the base ship of every case', () => {
    expect(Object.keys(bases).sort()).toEqual([
      'always',
      'buyback',
      'covered',
      'leaving',
      'partial',
      'unavailable',
    ]);
  });

  it('covers CCUs by each kind of pledge, several at once and not at all (#108, #111)', () => {
    const hangarShips = covers.flatMap((entry) =>
      entry.hangar.ships.map((match) => byId.get(match.id)!),
    );
    expect(
      hangarShips.some((pledge) => /^Standalone Ships/.test(pledge.title)),
      'ship',
    ).toBe(true);
    expect(
      hangarShips.some((pledge) => /^Package/.test(pledge.title)),
      'package',
    ).toBe(true);
    expect(
      hangarShips.some((pledge) => pledge.isUpgraded),
      'upgraded',
    ).toBe(true);
    expect(covers.some((entry) => entry.hangar.ccus.length)).toBe(true);
    expect(covers.some((entry) => entry.buyback.ships.length)).toBe(true);
    expect(covers.some((entry) => entry.buyback.ccus.length)).toBe(true);
    const kinds = (entry: CcuCoverage) =>
      [entry.hangar.ships, entry.hangar.ccus, entry.buyback.ships, entry.buyback.ccus].filter(
        (matches) => matches.length,
      ).length;
    expect(covers.some((entry) => kinds(entry) > 1)).toBe(true);
    expect(covers.some((entry) => !entry.covered)).toBe(true);
  });

  it("leaves out a buy back CCU RSI can't sell again (#207)", () => {
    const base = bases.unavailable!;
    expect(
      buyback.some((pledge) => pledge.unavailable && pledge.upgrade?.toShipId === base.id),
    ).toBe(true);
    const ccu = covers.find((entry) => entry.baseShip?.id === base.id)!;
    expect(ccu.covered).toBe(false);
    expect(standingOf(ccu, always)).toBe('missing');
  });

  it('lists each group with the same CCUs grouped, always available covered and not (#112, #113)', () => {
    for (const group of ['missing', 'buyback', 'always'] as const) {
      const rows = list.groups[group];
      expect(rows.length, group).toBeGreaterThan(0);
      const grouped = groupItems(viewsOf(rows.flatMap((row) => row.ccus)), pledgeFacts);
      // The Grouped View's `missing` group is giftable all along (#450), the cases' groups some.
      expect(
        grouped.some(
          (entry) => entry.count > 1 && (group === 'missing' || entry.giftable === 'some'),
        ),
        group,
      ).toBe(true);
    }
    const alwaysBase = (entry: CcuCoverage) =>
      entry.baseShip?.id !== undefined && always!.has(entry.baseShip.id);
    expect(covers.some((entry) => alwaysBase(entry) && entry.covered)).toBe(true);
    expect(covers.some((entry) => alwaysBase(entry) && !entry.covered)).toBe(true);
  });

  it('shows a ship leaving that is always available today, not one the buy back covers (#454)', () => {
    expect(list.soon.some((row) => row.shipId === bases.leaving!.id)).toBe(true);
    expect(list.soon.some((row) => row.shipId === bases.buyback!.id)).toBe(false);
    const soon = list.soon.find((row) => row.shipId === bases.leaving!.id)!;
    expect(groupItems(viewsOf(soon.ccus), pledgeFacts).some((entry) => entry.count > 1)).toBe(true);
  });

  it('has CCU groups covered fully, partly, by an always available base and not at all (#575)', () => {
    const { buyback: buybackCoverage } = groupCoverages(key);
    const hangarGroups = groupItems(
      pledges.filter((pledge) => pledge.isCcu),
      pledgeFacts,
    ).filter((group) => group.count > 1);
    const ofHangar = (base: number | undefined) =>
      hangarGroups
        .filter((group) => group.items[0]!.upgrade?.matchItems[0]?.id === base)
        .map((group) =>
          groupCoverage(
            group.items.map((item) => item.id),
            coverage,
          ),
        );
    // Fully by a hangar ship and a buy back ship.
    const full = ofHangar(bases.covered!.id)[0]!;
    expect([full.covered, full.total]).toEqual([2, 2]);
    expect(full.coverage.hangar.ships).toHaveLength(1);
    expect(full.coverage.buyback.ships).toHaveLength(1);
    const partial = ofHangar(bases.partial!.id)[0]!;
    expect([partial.covered, partial.total]).toEqual([2, 5]);
    const alwaysGroup = ofHangar(bases.always!.id)[0]!;
    expect(alwaysGroup.covered).toBe(0);
    expect(always!.has(bases.always!.id)).toBe(true);
    const missing = ofHangar(missingBaseOf(account.pledges))[0]!;
    expect(missing.covered).toBe(0);

    // The buy back's groups of each kind.
    expect(buybackCoverage(bases.covered!.id)).toEqual([2, 2]);
    expect(buybackCoverage(bases.partial!.id)).toEqual([2, 3]);
    expect(buybackCoverage(bases.always!.id)).toEqual([0, 2]);
    expect(buybackCoverage(missingBaseOf(account.pledges))).toEqual([0, 2]);
  });

  it('has CCUs whose base ship rises in price, confirmed and expected (#455)', () => {
    // Within the period of the settings: the tab shows them.
    const rising = pledges
      .flatMap((pledge: PledgeView) =>
        pledge.ccuPriceChange?.direction === 'loses' ? (pledge.ccuPriceChange.base ?? []) : [],
      )
      .filter((increase) => isWithinDays(increase, NOW, DEFAULT_SETTINGS.priceIncreaseDays));
    expect(rising.some((increase) => increase.confirmed)).toBe(true);
    expect(rising.some((increase) => !increase.confirmed)).toBe(true);
  });
});

describe('the demo settings of the CCU Consultant (#425)', () => {
  it('give every CCU a base ship with "CCUs without base ship coverage" off (#115)', () => {
    expect(missingCounts(consultant('any demo key').list).total).toBeGreaterThan(0);
    const { list } = consultant('any demo key', { ccuCoverageGaps: false });
    expect(missingCounts(list)).toEqual({ missing: 0, soon: 0, tooFew: 0, total: 0 });
  });

  it('leave no discount at risk with "CCUs with their discount at risk" off', () => {
    const { pledges } = consultant('any demo key', { ccuDiscountAtRisk: false });
    expect(pledges.some((pledge) => pledge.ccuPriceChange?.base)).toBe(false);
  });
});

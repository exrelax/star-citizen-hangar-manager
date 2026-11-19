import { describe, expect, it } from 'vitest';
import { BUYBACK_FILTER_PREDICATES } from '@/buyback/buyback-view';
import { PLEDGE_FILTER_PREDICATES } from '@/hangar/filters';
import { buildWarbondOffers, ownedCounts } from '@/store/warbond';
import { demoCatalog } from './catalog';
import { generatedDemo, justBoughtOf } from './demo';
import { demoEvents } from './demo-events';
import { demoStoreData } from './demo-store';
import {
  historyEntries,
  periodStart,
  runningEvent,
  withinPeriod,
  type HistoryPeriod,
} from '@/store/warbond-history-view';
import { creditForCases } from './demo-store-credit';
import { allShips } from '@/store/all-ships';
import {
  ALL_SHIPS_FILTERS,
  allShipsView,
  type AllShipsFilter,
  type AllShipsQuery,
} from '@/store/all-ships-view';
import type { FilterState } from '@/hangar/filters';
import { upcomingPriceIncreases } from '@/price-increases/price-increases';
import { upcomingShipRemovals } from '@/ship-removals/ship-removals';
import { demoShipRemovals } from './demo-ship-removals';
import { demoCompletedPlans, demoRunningPlan, RUNNING_PLAN_STAGES } from './demo-running-plan';

/*
 * Every case the demo always shows (#130), with the default demo settings on an account without
 * any stored data (the bundled catalog) – the list is in docs/DEVELOPMENT.md ("Demo mode").
 */

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const catalog = demoCatalog(undefined, undefined);
const { pledges, buyback, account } = generatedDemo(catalog, 'any demo key', TODAY, NOW);

describe('the default demo on an empty account (#130)', () => {
  it('shows every filter of My Hangar', () => {
    for (const [filter, matches] of Object.entries(PLEDGE_FILTER_PREDICATES)) {
      // Melt now: the demo's marks, set on the generated hangar (`use-demo.ts`).
      if (filter === 'meltNow' || filter === 'paintRebuy') continue;
      expect(pledges.some(matches), filter).toBe(true);
    }
  });

  it('shows every tag of My Hangar', () => {
    const has = (test: (pledge: (typeof pledges)[number]) => boolean) => pledges.some(test);
    expect(has((pledge) => pledge.insurance?.lifetime === true)).toBe(true);
    expect(has((pledge) => pledge.isUpgraded)).toBe(true);
    expect(has((pledge) => pledge.isGiftable) && has((pledge) => !pledge.isGiftable)).toBe(true);
    expect(has((pledge) => pledge.isMeltable) && has((pledge) => !pledge.isMeltable)).toBe(true);
    // One pledge per game (`SC · SQ42` on one pledge with the demo setting "together").
    const games = pledges.flatMap((pledge) => pledge.protectedGames);
    expect(games.sort()).toEqual(['SC', 'SQ42']);
    expect(has((pledge) => !!pledge.order)).toBe(true);
    expect(has((pledge) => !!pledge.priceIncrease)).toBe(true);
    expect(justBoughtOf(pledges)).toBeDefined();
  });

  it('shows applied upgrades and orders with invoices', () => {
    expect(account.upgradeLogs.size).toBeGreaterThan(0);
    expect(Object.keys(account.orders.orders).length).toBeGreaterThan(0);
  });

  it('shows buy back pledges of each kind and every filter of the buy back', () => {
    for (const [filter, matches] of Object.entries(BUYBACK_FILTER_PREDICATES)) {
      expect(buyback.some(matches), filter).toBe(true);
    }
    const sources = new Set(buyback.map((pledge) => pledge.price?.source ?? 'none'));
    expect(sources.size).toBe(4);
    expect(buyback.some((pledge) => pledge.unavailable)).toBe(true);
  });

  it('shows warbond CCUs in the Pledge Store tab with own CCUs in their price range', () => {
    const offers = buildWarbondOffers(demoStoreData(catalog, account.pledges), pledges, buyback);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.some((offer) => offer.owned.length > 0)).toBe(true);
  });

  it('shows offers with and without earlier ones, with and without an event (#4)', () => {
    const offers = buildWarbondOffers(demoStoreData(catalog, account.pledges), pledges, buyback);
    expect(offers.every((offer) => offer.history.since !== undefined)).toBe(true);
    expect(offers.some((offer) => offer.history.earlier.length === 0)).toBe(true);
    const earlier = offers.flatMap((offer) => offer.history.earlier);
    expect(earlier.some((sighting) => sighting.events?.length)).toBe(true);
    expect(earlier.some((sighting) => !sighting.events)).toBe(true);
    expect(offers.some((offer) => offer.history.events.length > 0)).toBe(true);
    expect(earlier.every((sighting) => sighting.price < sighting.msrp)).toBe(true);
  });

  it('shows expired offers in each period of the warbond history, with and without an event (#297)', () => {
    const data = demoStoreData(catalog, account.pledges, NOW, demoEvents(NOW));
    const expired = historyEntries(data.history, data.ships);
    const event = runningEvent(demoEvents(NOW), NOW);
    expect(event).toBeDefined();
    const count = (period: HistoryPeriod) =>
      withinPeriod(expired, periodStart(period, NOW, event)).length;
    expect(count('event')).toBe(3);
    expect(count('days30')).toBeGreaterThan(count('event'));
    expect(count('days90')).toBe(6);
    expect(count('days180')).toBe(10);
    expect(expired.length).toBeGreaterThan(count('days180'));
    // From several manufacturers' ships, for the search.
    expect(new Set(expired.map((entry) => entry.sighting.shipId)).size).toBeGreaterThan(8);
    expect(expired.some((entry) => entry.sighting.events?.length)).toBe(true);
    expect(expired.some((entry) => !entry.sighting.events)).toBe(true);
    // Current offers never show in the history.
    const current = new Set(data.warbonds.map((target) => `${target.skuId}|${target.price}`));
    expect(
      expired.some(
        (entry) =>
          entry.sighting.lastSeen === data.history!.lastReadAt &&
          current.has(`${entry.sighting.skuId}|${entry.sighting.price}`),
      ),
    ).toBe(false);

    // The own pledges as source (#298): a hangar without CCUs still gets current offers and the
    // same history.
    const own = demoStoreData(catalog, [], NOW, demoEvents(NOW));
    expect(own.warbonds).toHaveLength(3);
    const ownExpired = historyEntries(own.history, own.ships);
    expect(withinPeriod(ownExpired, periodStart('days180', NOW, event)).length).toBe(10);

    // Without a running event (demo settings) there is no event period.
    const upcoming = demoEvents(NOW).filter((candidate) => NOW < candidate.eventStart);
    const quiet = demoStoreData(catalog, account.pledges, NOW, upcoming);
    expect(runningEvent(upcoming, NOW)).toBeUndefined();
    expect(historyEntries(quiet.history, quiet.ships).length).toBe(expired.length);
  });

  it('shows the events and every case of the Paint Discount Consultant', () => {
    expect(demoEvents(NOW)).toHaveLength(2);
    const cases = creditForCases(pledges, catalog.items, {
      useFillers: true,
      skipGiftable: false,
    });
    expect(cases.same).toBeDefined();
    expect(cases.impossible).toBeDefined();
  });

  it("shows every stage of the consultant's running plan and its completed plans (#303)", () => {
    for (const stage of RUNNING_PLAN_STAGES) {
      const built = demoRunningPlan(stage, { pledges, items: catalog.items, now: NOW });
      expect(built, stage).toBeDefined();
      expect(built!.plan === null, stage).toBe(stage === 'none');
    }
    expect(new Set(demoCompletedPlans(catalog.items, NOW).map((plan) => plan.way))).toEqual(
      new Set(['melt', 'buy']),
    );
  });
});

describe('the own CCUs of a warbond offer in the default demo (#395)', () => {
  it('has one offer with at least three, of different discounts, one a surcharge', () => {
    const offers = buildWarbondOffers(demoStoreData(catalog, pledges, NOW), pledges, buyback);
    const sortable = offers.find((offer) => {
      const amounts = offer.owned.flatMap((ccu) => ccu.discount?.amount ?? []);
      return new Set(amounts).size >= 3 && amounts.some((amount) => amount < 0);
    });
    expect(sortable).toBeDefined();
  });
});

describe('the "x from" badge of the default demo (#399)', () => {
  it('shows first on one warbond offer and next to the other two badges on another', () => {
    const offers = buildWarbondOffers(demoStoreData(catalog, pledges, NOW), pledges, buyback);
    const counts = offers.map((offer) => ({ ...ownedCounts(offer), from: offer.fromShip }));
    expect(counts.some((count) => count.from > 0 && count.sameShip === 0)).toBe(true);
    expect(counts.some((count) => count.from > 0 && count.sameShip > 0 && count.others > 0)).toBe(
      true,
    );
  });
});

describe('the table of all ships in the default demo (#385, #390)', () => {
  it('counts CCUs from and to ships and standalone ships, in the hangar and the buy back', () => {
    const store = demoStoreData(catalog, pledges, NOW);
    const rows = allShips({
      ships: store.ships,
      buyable: [],
      warbonds: store.warbonds.map((offer) => ({
        shipId: offer.ship.id,
        skuId: offer.skuId,
        price: offer.price,
      })),
      hangar: pledges,
      buyback,
    });
    for (const key of [
      'hangarFrom',
      'hangarTo',
      'buybackFrom',
      'buybackTo',
      'hangarShips',
      'buybackShips',
    ] as const) {
      expect(
        rows.some((row) => row[key] > 0),
        key,
      ).toBe(true);
    }
    expect(rows.some((row) => row.warbondPrice !== undefined)).toBe(true);
    expect(rows.some((row) => row.warbondPrice === undefined)).toBe(true);
  });
});

describe('the price increases, ships leaving and filters of the all ships table (#390)', () => {
  // RSI sells CCUs to most ships, as the stored upgrade tool says; not to every seventh.
  const buyable = new Set(catalog.ships.map((ship) => ship.id).filter((id) => id % 7 !== 0));
  const demo = generatedDemo(catalog, 'any demo key', TODAY, NOW, undefined, buyable);
  const store = demoStoreData(catalog, demo.pledges, NOW);
  const { removals } = demoShipRemovals({
    ships: catalog.ships,
    hangar: demo.pledges,
    buyback: demo.buyback,
    buyable,
    warbondShips: new Set(store.warbonds.map((offer) => offer.ship.id)),
    avoid: new Set(demo.priceIncreases.map((increase) => increase.ship.id)),
    now: NOW,
  });
  const increases = upcomingPriceIncreases(demo.priceIncreases, NOW);
  const rows = allShips({
    ships: store.ships,
    buyable: [...buyable].map((shipId) => ({
      shipId,
      skuId: 100_000 + shipId,
      title: 'Standard Edition',
      price: 1,
    })),
    warbonds: store.warbonds.map((offer) => ({
      shipId: offer.ship.id,
      skuId: offer.skuId,
      price: offer.price,
    })),
    hangar: demo.pledges,
    buyback: demo.buyback,
    increases,
    removals: upcomingShipRemovals(removals, NOW),
  });
  const view = (include: AllShipsFilter[], exclude: AllShipsFilter[] = []) => {
    const filters = new Map<AllShipsFilter, FilterState>([
      ...include.map((filter) => [filter, 'include'] as const),
      ...exclude.map((filter) => [filter, 'exclude'] as const),
    ]);
    const query: AllShipsQuery = { search: '', min: 0, max: Infinity, filters };
    return allShipsView(rows, query);
  };

  it('shows price increases confirmed and expected, with and without a new price', () => {
    const shown = rows.flatMap((row) => row.priceIncrease ?? []);
    expect(shown.some((increase) => increase.confirmed)).toBe(true);
    expect(shown.some((increase) => !increase.confirmed)).toBe(true);
    expect(shown.some((increase) => increase.price)).toBe(true);
    expect(shown.some((increase) => !increase.price)).toBe(true);
    // On its last day (the warning color) and before.
    const DAY = 24 * 60 * 60 * 1000;
    expect(shown.some((increase) => increase.priceIncreaseAt.at - NOW < DAY)).toBe(true);
    expect(shown.some((increase) => increase.priceIncreaseAt.at - NOW > DAY)).toBe(true);
  });

  it('shows ships leaving on a day and at a time', () => {
    const leaving = rows.flatMap((row) => row.removal ?? []);
    expect(leaving.some((removal) => removal.removedAt.dayOnly)).toBe(true);
    expect(leaving.some((removal) => !removal.removedAt.dayOnly)).toBe(true);
  });

  it('shows ships on sale and not, each filter included and excluded (#406, #410, #413)', () => {
    // "Always available" comes from the website's ship facts, the same in the demo and outside.
    for (const filter of ALL_SHIPS_FILTERS.filter((filter) => filter !== 'alwaysAvailable')) {
      expect(view([filter]).length, `${filter} included`).toBeGreaterThan(0);
      // The bundled catalog's ships all are in the demo hangar or buy back; a stored one has more.
      if (filter !== 'owned') {
        expect(view([], [filter]).length, `${filter} excluded`).toBeGreaterThan(0);
      }
    }
    expect(view(['priceIncrease', 'onSale']).length).toBeGreaterThan(0);
    expect(view(['onSale'], ['leaving']).length).toBeGreaterThan(0);
    // No match: every warbond offer is on sale.
    expect(view(['warbond'], ['onSale'])).toEqual([]);
  });
});

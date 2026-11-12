import { describe, expect, it } from 'vitest';
import { BUYBACK_FILTER_PREDICATES } from '@/buyback/buyback-view';
import { PLEDGE_FILTER_PREDICATES } from '@/hangar/filters';
import { buildWarbondOffers } from '@/store/warbond';
import { demoCatalog } from './catalog';
import { generatedDemo, justBoughtOf } from './demo';
import { demoEvents } from './demo-events';
import { demoStoreData } from './demo-store';
import { creditForCases } from './demo-store-credit';

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

  it('shows the events and every case of the Paint Discount Consultant', () => {
    expect(demoEvents(NOW)).toHaveLength(2);
    const cases = creditForCases(pledges, catalog.items, {
      useFillers: true,
      skipGiftable: false,
    });
    expect(cases.same).toBeDefined();
    expect(cases.impossible).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';
import { freedCreditOf, rebuyables, type RebuyReasonCode } from '@/melt-rebuy/rebuyable';
import { rebuyWatchPlan } from '@/melt-rebuy/rebuy-watchlist';
import type { Ship, ShipSku } from '@/ships/ships';
import { priceChangeOf, storeCostOf } from '@/watchlists/store-cost';
import { storeStatus } from '@/watchlists/store-status';
import { FALLBACK_CATALOG, type DemoCatalog } from './catalog';
import { demoPurchaseTime, generatedDemo, justBoughtOf } from './demo';
import { ccuCaseBasesOf } from './demo-ccu-cases';
import { missingBaseOf } from './demo-groups';
import {
  NOT_REBUYABLE_CASES,
  REBUYABLE_CASES,
  rebuyWatchlistCases,
  type DemoRebuyCase,
} from './demo-rebuy-cases';
import { demoRebuyInput, demoRebuyStore } from './demo-rebuy-store';
import { DEFAULT_DEMO_SETTINGS, demoSettingsOf, type DemoSettings } from './demo-settings';
import { demoShipRemovals } from './demo-ship-removals';
import { demoWatchlists } from './demo-watchlists';

/*
 * Melt and Rebuy's cases in the demo (#532): each rebuyable kind and each reason against it on its
 * own pledge, on every demo key, the List Shortcut's count and freed store credit, the demo
 * setting that empties it, and the demo's watchlist of pledges to rebuy.
 */

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const KEYS = ['key-a', 'key-b', 'key-c', 'another key'];

/** The bundled catalog with more ships, as the upgrade tool knows far more than it. */
const LARGE: DemoCatalog = {
  ...FALLBACK_CATALOG,
  ships: [
    ...FALLBACK_CATALOG.ships,
    ...Array.from({ length: 24 }, (_, index) => ({
      id: 600 + index,
      name: `Demo Ship ${String.fromCharCode(65 + index)}`,
      msrp: 40 + index * 35,
    })),
  ],
};

const skusOf = (ships: readonly Ship[]): ShipSku[] =>
  ships.map((ship) => ({ shipId: ship.id, skuId: ship.id, title: ship.name, price: ship.msrp }));

/** The rules on a demo hangar, with its store, removals and purchases as the manager gives them. */
function demo(
  key: string,
  catalog: DemoCatalog = LARGE,
  settings: Partial<DemoSettings> = {},
  buyable?: readonly ShipSku[],
) {
  const demoSettings = { ...DEFAULT_DEMO_SETTINGS, ...settings };
  const ids = buyable && new Set(buyable.map((sku) => sku.shipId));
  const result = generatedDemo(catalog, key, TODAY, NOW, demoSettings, ids);
  const { pledges, buyback, account, rebuyShips } = result;
  const bases = ccuCaseBasesOf(account.pledges, catalog);
  const { removals } = demoShipRemovals({
    ships: catalog.ships,
    hangar: pledges,
    buyback,
    ...(ids && { buyable: ids }),
    warbondShips: new Set(),
    avoid: new Set(result.priceIncreases.map((increase) => increase.ship.id)),
    ccuCases: {
      leaving: bases.leaving?.id,
      covered: bases.buyback?.id,
      stay: [
        ...[
          bases.always,
          bases.unavailable,
          bases.covered,
          bases.partial,
          bases.chainStart,
          bases.chainLink,
        ].flatMap((ship) => (ship ? [ship.id] : [])),
        ...[missingBaseOf(account.pledges)].filter((id) => id !== undefined),
      ],
    },
    rebuy: {
      leaving: rebuyShips.removal?.id,
      stay: Object.entries(rebuyShips).flatMap(([role, ship]) =>
        role === 'removal' ? [] : [ship.id],
      ),
    },
    now: NOW,
  });
  const store = demoRebuyStore({ catalog, ships: rebuyShips, ...(buyable && { buyable }) });
  const justBought = justBoughtOf(pledges);
  const input = demoRebuyInput(
    {
      pledges,
      context: {
        catalog: {},
        alwaysAvailable: () => undefined,
        removals: new Map(removals.map((removal) => [removal.ship.id, removal])),
        purchases: new Map(
          pledges.map((pledge) => [
            pledge.id,
            {
              on: pledge.createdAt,
              ...(pledge.id === justBought && { at: demoPurchaseTime(NOW) }),
            },
          ]),
        ),
        now: NOW,
        today: TODAY,
      },
    },
    store,
    demoSettings.rebuyable,
  );
  const rebuys = rebuyables(input.pledges, input.context);
  const byCase = (role: DemoRebuyCase) =>
    account.pledges.filter((pledge) => pledge.demoRebuyCase === role).map((pledge) => pledge.id);
  const reasonsOf = (role: DemoRebuyCase) =>
    byCase(role).map((id) => rebuys.get(id)!.reasons.map((reason) => reason.code));
  return { ...result, store, input, rebuys, byCase, reasonsOf, justBought };
}

const REASONS: Record<(typeof NOT_REBUYABLE_CASES)[number], RebuyReasonCode[]> = {
  giftable: ['giftable'],
  discount: ['discount'],
  upgraded: ['upgraded'],
  package: ['package'],
  extraItems: ['extraItems'],
  notOnSale: ['notOnSale'],
  insurance: ['insurance'],
  priceIncrease: ['priceIncrease'],
  removal: ['removal'],
  notAlwaysAvailable: ['notAlwaysAvailable'],
  unknown: ['unknown'],
  refund: ['refundPeriod'],
  several: ['giftable', 'discount', 'priceIncrease'],
};

describe.each(KEYS)('Melt and Rebuy in the demo %s (#532)', (key) => {
  const { rebuys, reasonsOf, byCase, justBought, rebuyShips } = demo(key);

  it('has a ship for each role', () => {
    expect(Object.keys(rebuyShips).sort()).toEqual(
      ['base', 'increase', 'limited', 'removal', 'target', 'unknown'].sort(),
    );
    expect(new Set(Object.values(rebuyShips).map((ship) => ship.id)).size).toBe(6);
  });

  it.each(REBUYABLE_CASES)('has a rebuyable pledge: %s', (role) => {
    expect(reasonsOf(role)).toEqual([[]]);
  });

  it('has a pledge worth more than its price now', () => {
    const rebuy = rebuys.get(byCase('higherValue')[0]!)!;
    expect(rebuy.freedCredit).toBeGreaterThan(rebuy.rebuyPrice!);
  });

  it.each(Object.entries(REASONS))(
    'has a pledge not rebuyable for its reason: %s',
    (role, codes) => {
      expect(reasonsOf(role as DemoRebuyCase)).toEqual([codes]);
    },
  );

  it('knows the insurance the store sells instead, and the price increase as expected', () => {
    const [insurance] = rebuys.get(byCase('insurance')[0]!)!.reasons;
    expect(insurance).toMatchObject({ code: 'insurance', insurance: { lifetime: true } });
    expect(insurance).toHaveProperty('offered', { lifetime: false, months: 120 });
    const [unknown] = rebuys.get(byCase('unknown')[0]!)!.reasons;
    expect(unknown).toEqual({ code: 'unknown', missing: 'availability' });
  });

  it('has the pledge bought a few hours ago not rebuyable for that alone', () => {
    expect(justBought).toBeDefined();
    expect(rebuys.get(justBought!)!.reasons.map((reason) => reason.code)).toEqual(['tooRecent']);
  });

  it('gives the List Shortcut its pledges and the store credit they free', () => {
    const rebuyable = [...rebuys.values()].filter((rebuy) => rebuy.rebuyable);
    expect(rebuyable.length).toBeGreaterThanOrEqual(REBUYABLE_CASES.length);
    expect(freedCreditOf(rebuyable)).toBeGreaterThan(0);
  });

  it('puts the rebuyable paint twice on a watchlist, as one item counted twice', () => {
    const ids = [...REBUYABLE_CASES.flatMap(byCase), byCase('giftable')[0]!];
    const plan = rebuyWatchPlan(ids, rebuys, (from, to) => `${from} to ${to}`)!;
    expect(plan.pledgeIds).toHaveLength(5);
    expect(plan.skipped).toBe(1);
    // With the paint bought at a volume discount, an item of its own (#593).
    expect(plan.items.map((item) => [item.kind, item.count])).toEqual([
      ['storePaint', 2],
      ['storeShip', 1],
      ['storeCcu', 1],
      ['storePaint', 1],
    ]);
    expect(plan.items[1]).toMatchObject({ insurance: 120 });
  });
});

describe('Melt and Rebuy on the bundled catalog (#532)', () => {
  it.each(KEYS)('shows every case of %s, each once, rebuyable or not as it should', (key) => {
    const { rebuys, byCase } = demo(key, FALLBACK_CATALOG);
    for (const role of REBUYABLE_CASES) {
      expect(byCase(role)).toHaveLength(1);
      expect(rebuys.get(byCase(role)[0]!)!.rebuyable).toBe(true);
    }
    for (const [role, codes] of Object.entries(REASONS)) {
      expect(byCase(role as DemoRebuyCase)).toHaveLength(1);
      const reasons = rebuys.get(byCase(role as DemoRebuyCase)[0]!)!.reasons.map((r) => r.code);
      for (const code of codes) expect(reasons).toContain(code);
    }
  });

  it('works with the ships RSI sells CCUs to as stored', () => {
    const buyable = skusOf(LARGE.ships.filter((ship) => ship.id % 3 !== 0));
    const { reasonsOf } = demo('key-a', LARGE, {}, buyable);
    for (const role of REBUYABLE_CASES) expect(reasonsOf(role)).toEqual([[]]);
    expect(reasonsOf('removal')).toEqual([['removal']]);
  });
});

describe('the demo setting "Rebuyable pledges" (#532)', () => {
  it.each(KEYS)('off, leaves none rebuyable in %s, the other cases still there', (key) => {
    const { rebuys, byCase, reasonsOf } = demo(key, LARGE, { rebuyable: false });
    expect([...rebuys.values()].some((rebuy) => rebuy.rebuyable)).toBe(false);
    for (const role of REBUYABLE_CASES) expect(byCase(role)).toEqual([]);
    expect(reasonsOf('insurance')).toEqual([['insurance']]);
    expect(reasonsOf('removal')).toEqual([['removal']]);
  });

  it('is on by default', () => {
    expect(DEFAULT_DEMO_SETTINGS.rebuyable).toBe(true);
  });
});

describe.each(KEYS)('the demo’s watchlists with Melt and Rebuy in %s (#532)', (key) => {
  const { pledges, buyback, account, rebuyShips, store } = demo(key);
  const { lists } = demoWatchlists({
    hangar: pledges,
    buyback,
    ships: LARGE.ships,
    items: store.catalog.items!,
    buyable: store.catalog.buyable!,
    rebuy: rebuyWatchlistCases(account.pledges, rebuyShips, LARGE),
    now: NOW,
    locale: 'en',
  });
  const rebuy = lists.find((list) => list.id === 'demorebuy')!;

  it('has a watchlist of pledges to rebuy: a paint twice, a ship pricier now, one off sale', () => {
    expect(rebuy.name).toMatch(/^Rebuy after /);
    expect(rebuy.dueAt).toBeGreaterThan(NOW);
    expect(rebuy.items.map((item) => item.kind)).toEqual([
      'storePaint',
      'storeShip',
      'storeCcu',
      'storePaint',
    ]);
    expect(rebuy.items[0]).toMatchObject({ count: 2 });
    const statuses = rebuy.items.map((item) => storeStatus(item, store.catalog));
    expect(statuses.slice(0, 3).every((status) => status.onSale)).toBe(true);
    expect(priceChangeOf(rebuy.items[1]!, statuses[1])).toMatchObject({ higher: true });
    expect(statuses[3]).toEqual({ onSale: false });
    const cost = storeCostOf(rebuy.items, store.catalog);
    expect(cost).toMatchObject({ items: 4, changed: 2, unknown: 0 });
    // More than the demo's store credit by default (#179), less than its highest.
    expect(cost.total).toBeGreaterThan(DEFAULT_DEMO_SETTINGS.storeCredit);
  });

  it('keeps the standalone ship with LTI of "CCUs to buy when back in stock" on sale (#474)', () => {
    const stock = lists.find((list) => list.id === 'demostock')!;
    const ship = stock.items.find((item) => item.kind === 'storeShip')!;
    expect(ship).toMatchObject({ insurance: 'lti' });
    expect(storeStatus(ship, store.catalog).onSale).toBe(true);
  });
});

describe('demoSettingsOf with "Rebuyable pledges" (#532)', () => {
  it('keeps the setting, the default for anything else', () => {
    expect(demoSettingsOf({ rebuyable: false }).rebuyable).toBe(false);
    expect(demoSettingsOf({ rebuyable: 'no' as never }).rebuyable).toBe(true);
    expect(demoSettingsOf(null).rebuyable).toBe(true);
  });
});

import { DEMO } from '@/config';
import type { BuybackPledge } from '@/buyback/buyback';
import type { GiftFlags } from '@/buyback/gift-flags';
import type { Ship } from '@/ships/ships';
import type { StoreItem } from '@/store/items/store-items';
import type { OrdersSnapshot } from '@/orders/orders';
import type { DemoCatalog } from './catalog';
import { usdText } from './generate-hangar';
import { createRandom, type DemoRandom } from './random';

/*
 * The generated buy back of the demo (#177), from the public catalog like the generated hangar:
 * melted ships, game packages, CCUs, paints, gear, add-ons and rewards, with their orders. Their
 * buy back prices come from every source the list knows (#185): the buy back page (`price`, e.g.
 * game packages), the ships' standard prices (CCUs, standalone ships) and the Pledge Store (single
 * items) – and an item the store doesn't sell has none.
 */

/** How many pledges of each kind the generated buy back has. */
export interface DemoBuybackComposition {
  ships: number;
  packages: number;
  ccus: number;
  paints: number;
  gear: number;
  addOns: number;
  withoutPrice: number;
  rewards: number;
}

/** The generated buy back with what belongs to it. */
export interface DemoBuyback {
  pledges: BuybackPledge[];
  /** The orders of the buy back pledges, as the order sync stores them. */
  orders: Pick<OrdersSnapshot, 'pledgeOrders' | 'orders'>;
  /** RSI's gift flags remembered when pledges left the hangar (#204). */
  giftFlags: GiftFlags;
  /** Buy back tokens left. */
  tokens: number;
}

/** Items the store doesn't sell (any more): their buy back price is unknown. */
const DISCONTINUED = ['Gear - Discontinued Explorer Helmet', 'Gear - Retired Racing Suit'];
const REWARDS = ['Referral Bonus - Origin Racing Gear Pack', 'IAE 2954 - Hangar Poster'];

/** Days between 2023-01-01 and today, for the melt dates. */
const meltDate = (random: DemoRandom, label: string, today: string) => {
  const from = Date.parse('2023-01-01T00:00:00Z');
  const to = Date.parse(`${today}T00:00:00Z`);
  return new Date(from + random.at(label) * (to - from)).toISOString().slice(0, 10);
};

/** A single-item pledge of the store: its name is the "Contained". */
function storeItemPledge(entry: StoreItem): Omit<BuybackPledge, 'id'> {
  return {
    title: `${entry.category} - ${entry.name}`,
    contained: entry.name,
    isUpgrade: false,
    ...(entry.image && { image: entry.image }),
  };
}

function shipPledge(ship: Ship, lifetime: boolean): Omit<BuybackPledge, 'id'> {
  return {
    title: `Standalone Ships - ${ship.name} - ${lifetime ? 'LTI' : '10 Year'}`,
    contained: `${ship.name} and 2 items`,
    items: [
      ship.name,
      lifetime ? 'Lifetime Insurance' : '120 Month Insurance',
      'Hangar Decoration',
    ],
    isUpgrade: false,
    category: 'standalone_ship',
  };
}

/** A CCU from `from` to `to`, with the ids of the upgrade tool its "Buy Back" button carries. */
export function ccuPledge(from: Ship, to: Ship, edition = 'Standard'): Omit<BuybackPledge, 'id'> {
  const title = `Upgrade - ${from.name} to ${to.name} ${edition} Edition`;
  return {
    title,
    contained: title,
    isUpgrade: true,
    upgrade: { fromShipId: from.id, toShipId: to.id, toSkuId: DEMO.idBase - to.id },
  };
}

/** The generated buy back of a key, newest melted first. */
export function generateBuyback(
  catalog: DemoCatalog,
  key: string,
  today: string,
  composition: DemoBuybackComposition = DEMO.buybackComposition,
): DemoBuyback {
  const random = createRandom(`${key}:buyback`);
  const sorted = [...catalog.ships].sort((a, b) => a.msrp - b.msrp);
  const made: Omit<BuybackPledge, 'id'>[] = [];
  const times = (count: number, make: (index: number) => Omit<BuybackPledge, 'id'> | undefined) => {
    for (let index = 0; index < count; index++) {
      const pledge = make(index);
      if (pledge) made.push(pledge);
    }
  };
  const itemsOf = (category: string) =>
    catalog.items.filter((entry) => entry.category === category);

  times(composition.ships, (index) =>
    shipPledge(random.pick(`ship:${index}`, catalog.ships)!, index % 2 === 0),
  );
  times(composition.packages, (index) => {
    const ship = random.pick(`package:${index}`, sorted.slice(0, 6))!;
    // Only its buy back page knows a game package's price.
    return {
      title: `Package - ${ship.name} Starter Pack`,
      contained: `${ship.name} and 3 items`,
      items: [
        ship.name,
        'Star Citizen Digital Download',
        '6 Month Insurance',
        'Starter Ship Poster',
      ],
      isUpgrade: false,
      category: 'game_package',
      price: ship.msrp + 20,
    };
  });
  times(composition.ccus, (index) => {
    const from = sorted[random.int(`ccu:${index}:from`, 0, sorted.length - 2)]!;
    const to =
      random.pick(
        `ccu:${index}:to`,
        sorted.filter((ship) => ship.msrp > from.msrp),
      ) ?? sorted.at(-1)!;
    return ccuPledge(from, to, random.chance(`ccu:${index}:warbond`, 0.3) ? 'Warbond' : 'Standard');
  });
  made.push(...unavailableCcus(sorted));
  times(composition.paints, (index) => {
    const entry = random.pick(`paint:${index}`, itemsOf('Paints'));
    return entry && storeItemPledge(entry);
  });
  times(composition.gear, (index) => {
    const entry = random.pick(`gear:${index}`, itemsOf('Gear'));
    return entry && storeItemPledge(entry);
  });
  times(composition.addOns, (index) => {
    const entry = random.pick(`addOn:${index}`, itemsOf('Add-Ons'));
    return entry && storeItemPledge(entry);
  });
  times(composition.withoutPrice, (index) => {
    const title = DISCONTINUED[index % DISCONTINUED.length]!;
    return { title, contained: title.replace(/^Gear - /, ''), isUpgrade: false, price: null };
  });
  times(composition.rewards, (index) => {
    const title = REWARDS[index % REWARDS.length]!;
    return { title, contained: title.replace(/^.+? - /, ''), isUpgrade: false };
  });

  const dated = made.map((pledge, index) => ({
    ...pledge,
    reclaimedAt: meltDate(random, `melted:${index}`, today),
  }));
  dated.sort((a, b) => b.reclaimedAt.localeCompare(a.reclaimedAt));
  const pledges: BuybackPledge[] = dated.map((pledge, position) => ({
    ...pledge,
    id: DEMO.idBase - 200_000 - position * 37,
  }));
  // Some were bought with money, a while before they were melted.
  const orders: DemoBuyback['orders'] = { pledgeOrders: {}, orders: {} };
  for (const pledge of pledges) {
    const price = typeof pledge.price === 'number' ? pledge.price : 0;
    if (pledge.title.startsWith('Referral') || !random.chance(`order:${pledge.id}`, 0.3)) continue;
    const placedAt = meltDate(random, `bought:${pledge.id}`, pledge.reclaimedAt!);
    buybackOrder(orders, pledge.id, placedAt, price || random.int(`paid:${pledge.id}`, 5, 60));
  }
  const giftFlags = withGiftableCases(pledges, orders);
  return { pledges, orders, giftFlags, tokens: random.int('tokens', 1, 5) };
}

/**
 * Every case of "probably giftable" (#205), on the newest melted pledges that have a price, each
 * from made-up orders: money only before the cutoff (also a buy back paid with money), store
 * credit only, money and store credit, money on or after the cutoff, no known order, RSI's gift
 * flag remembered (giftable and not, overruling the order), and two pledges of one order.
 */
function withGiftableCases(
  pledges: readonly BuybackPledge[],
  orders: DemoBuyback['orders'],
): Record<string, boolean> {
  // Not on CCUs: one RSI can't sell again is never giftable (#208).
  const cases = pledges.filter(
    (pledge) => !pledge.isUpgrade && !pledge.title.startsWith('Referral') && pledge.price !== null,
  );
  const [
    money,
    buyback,
    credit,
    mixed,
    late,
    unknown,
    flaggedYes,
    flaggedNo,
    sameOrderA,
    sameOrderB,
  ] = cases;
  const before = '2026-09-14';
  const after = '2026-11-02';
  const giftFlags: Record<string, boolean> = {};
  const set = (pledge: BuybackPledge | undefined, apply: (id: number) => void) => {
    if (!pledge) return;
    delete orders.pledgeOrders[pledge.id];
    apply(pledge.id);
  };
  set(money, (id) => buybackOrder(orders, id, before, 40));
  set(buyback, (id) => {
    buybackOrder(orders, id, '2025-06-20', 25);
    orders.pledgeOrders[id]!.buyback = true;
  });
  set(credit, (id) => buybackOrder(orders, id, before, 0, 30));
  set(mixed, (id) => buybackOrder(orders, id, before, 20, 10));
  set(late, (id) => buybackOrder(orders, id, after, 35));
  set(unknown, () => undefined);
  set(flaggedYes, (id) => {
    buybackOrder(orders, id, after, 0, 15);
    giftFlags[id] = true;
  });
  set(flaggedNo, (id) => {
    buybackOrder(orders, id, before, 45);
    giftFlags[id] = false;
  });
  set(sameOrderA, (id) => buybackOrder(orders, id, before, 60));
  set(sameOrderB, (id) => {
    orders.pledgeOrders[id] = { ...orders.pledgeOrders[sameOrderA!.id]! };
  });
  return giftFlags;
}

/**
 * CCUs RSI can't sell again (#208): its base ship now costs more than its target ship, and one
 * where both cost the same – from the catalog's standard prices, next to the CCUs that can be
 * bought back.
 */
function unavailableCcus(sorted: readonly Ship[]): Omit<BuybackPledge, 'id'>[] {
  const cheaper = sorted[Math.floor(sorted.length / 3)];
  const pricier = sorted[Math.floor((sorted.length * 2) / 3)];
  const ccus =
    cheaper && pricier && cheaper.msrp < pricier.msrp ? [ccuPledge(pricier, cheaper)] : [];
  const same = sorted.findIndex(
    (ship, index) => index > 0 && ship.msrp === sorted[index - 1]!.msrp,
  );
  if (same > 0) ccus.push(ccuPledge(sorted[same - 1]!, sorted[same]!));
  return ccus;
}

/** A money-paid order of a buy back pledge, placed on `placedAt`. */
export function buybackOrder(
  orders: DemoBuyback['orders'],
  pledgeId: number,
  placedAt: string,
  money: number,
  credit = 0,
): void {
  const orderId = `DEMOB${(DEMO.idBase - pledgeId).toString(36).toUpperCase().padStart(8, '0')}`;
  orders.orders[orderId] = {
    id: orderId,
    amount: usdText(money),
    creditsUsed: usdText(credit),
    placedAt,
  };
  orders.pledgeOrders[pledgeId] = { orderId, buyback: false };
}

import { DEMO } from '@/config';
import type { Game, PledgeItem, UpgradeTarget } from '@/hangar/pledge';
import type { UpgradeLogEntry } from '@/hangar/upgrade-log';
import {
  DEMO_BILL_TO,
  DEMO_PROCESSOR,
  ORDERS_SNAPSHOT_VERSION,
  type Order,
  type OrderDetails,
  type OrdersSnapshot,
} from '@/orders/orders';
import type { DemoCatalog } from './catalog';
import { generateHangar, usdText, type DemoPledge } from './generate-hangar';
import { createRandom, type DemoRandom } from './random';
import { DEFAULT_DEMO_SETTINGS, type DemoSettings, type DemoStates } from './demo-settings';

/*
 * The states of the generated demo pledges (#176), so every tag, filter and action can be shown:
 * meltable or not, giftable or not, insurances (LTI, years, months, several at once), upgraded
 * with "Applied upgrades", protected game access (`SC`, `SQ42`, `SC · SQ42`, a reward without a
 * ship), and orders paid with money, with store credit or both, with their invoices. Each state
 * is on at least one pledge; the rest is spread by the demo key. The dates – the refund countdown
 * and the pledge bought a few hours ago – follow from the orders (`demoDates` in `demo.ts`).
 */

/** The generated hangar with everything that belongs to it besides the pledges. */
export interface DemoAccount {
  pledges: DemoPledge[];
  /** The orders of the pledges, as the order sync stores them. */
  orders: OrdersSnapshot;
  /** The applied CCUs of the upgraded pledges, by pledge id. */
  upgradeLogs: ReadonlyMap<number, UpgradeLogEntry[]>;
}

const insurance = (title: string): PledgeItem => ({ title, kind: 'Insurance' });
const INSURANCES = [
  'Lifetime Insurance',
  '120 Month Insurance',
  '72 Month Insurance',
  '6 Month Insurance',
];
const SQ42: PledgeItem = { title: 'Squadron 42 Digital Download', kind: 'Digital Download' };

/** The first pledges of a kind, in the list's order. */
const ofKind = (pledges: readonly DemoPledge[], kind: DemoPledge['demoKind']) =>
  pledges.filter((pledge) => pledge.demoKind === kind);

/** Replaces the insurances of a pledge. */
function withInsurances(pledge: DemoPledge, titles: readonly string[]): DemoPledge {
  return {
    ...pledge,
    items: [...pledge.items.filter((item) => item.kind !== 'Insurance'), ...titles.map(insurance)],
  };
}

/**
 * An upgraded ship: its pledge keeps its name, the ship item is the target of the last CCU, and
 * its value grew by every step (#176).
 */
function upgraded(
  pledge: DemoPledge,
  catalog: DemoCatalog,
  random: DemoRandom,
  index: number,
): { pledge: DemoPledge; log: UpgradeLogEntry[] } {
  const base = pledge.items.find((item) => item.kind === 'Ship')!;
  const baseShip = catalog.ships.find((ship) => ship.name === base.title);
  const pricier = [...catalog.ships]
    .filter((ship) => ship.msrp > (baseShip?.msrp ?? 0))
    .sort((a, b) => a.msrp - b.msrp);
  const steps =
    pricier.length < 2
      ? pricier
      : [
          pricier[random.int(`up:${index}:a`, 0, Math.floor(pricier.length / 2) - 1)]!,
          pricier[random.int(`up:${index}:b`, Math.floor(pricier.length / 2), pricier.length - 1)]!,
        ];
  let value = pledge.valueUsd;
  let from = base.title;
  const log = steps.map((ship, step) => {
    const added = Math.max(
      5,
      Math.round(
        ((ship.msrp - (step ? steps[step - 1]!.msrp : (baseShip?.msrp ?? value))) *
          (random.chance(`up:${index}:${step}:wb`, 0.5) ? 0.7 : 1)) /
          5,
      ) * 5,
    );
    value += added;
    const entry: UpgradeLogEntry = {
      appliedAt: '',
      ccuId: DEMO.idBase - 50_000 - index * 10 - step,
      name: `Upgrade - ${from} to ${ship.name} Standard Edition`,
      valueAfter: value,
      ...(step > 0 && { added }),
    };
    from = ship.name;
    return entry;
  });
  const target = steps.at(-1);
  if (!target) return { pledge, log: [] };
  return {
    pledge: {
      ...pledge,
      isUpgraded: true,
      // RSI lists the insurance of every step: the best one counts (several insurances).
      items: [
        { title: target.name, kind: 'Ship', ...(target.image && { image: target.image }) },
        insurance('Lifetime Insurance'),
        insurance('120 Month Insurance'),
      ],
      value: usdText(value),
      valueUsd: value,
      isGiftable: false,
    },
    log,
  };
}

/** The game access a pledge is protected for, with the games' items. */
function protectedFor(pledge: DemoPledge, games: Game[]): DemoPledge {
  const items = pledge.items.filter((item) => item.kind !== 'Digital Download');
  if (games.includes('SC'))
    items.push({ title: 'Star Citizen Digital Download', kind: 'Digital Download' });
  if (games.includes('SQ42')) items.push(SQ42);
  return { ...pledge, items, protectedGames: games };
}

/** A made-up order id like RSI's ("J4SHJM5S2GUF5"), fixed by the pledge. */
const orderIdOf = (pledgeId: number) =>
  `DEMO${(DEMO.idBase - pledgeId).toString(36).toUpperCase().padStart(9, '0')}`;

/**
 * The orders: warbond pledges and a share of the others paid with money, some of them in part
 * with store credit, the rest with store credit only.
 */
function ordersOf(pledges: readonly DemoPledge[], random: DemoRandom): OrdersSnapshot {
  const pledgeOrders: OrdersSnapshot['pledgeOrders'] = {};
  const orders: OrdersSnapshot['orders'] = {};
  pledges.forEach((pledge, index) => {
    if (pledge.valueUsd <= 0) return;
    const orderId = orderIdOf(pledge.id);
    const warbond = /warbond/i.test(pledge.title);
    // The first two money-paid pledges get the refund countdown (`DEMO.refundDaysLeft`).
    // The newest pledge was bought with store credit a few hours ago (`justBoughtOf`).
    const money =
      index > 0 && (warbond || index < 6 || random.chance(`order:${pledge.id}:money`, 0.2));
    const mixed = money && !warbond && random.chance(`order:${pledge.id}:mixed`, 0.25);
    const credit = mixed ? Math.min(pledge.valueUsd - 1, Math.round(pledge.valueUsd / 3)) : 0;
    const paid = money ? pledge.valueUsd - credit : 0;
    orders[orderId] = {
      id: orderId,
      amount: usdText(paid),
      creditsUsed: usdText(money ? credit : pledge.valueUsd),
    };
    pledgeOrders[pledge.id] = { orderId, buyback: false };
  });
  return {
    version: ORDERS_SNAPSHOT_VERSION,
    syncedAt: new Date(0).toISOString(),
    pledgeOrders,
    orders,
    recentLogEntries: [],
    creditsRead: true,
  };
}

/** The generated hangar of a key with its states and orders. */
export const generateDemoAccount = (
  catalog: DemoCatalog,
  key: string,
  settings: DemoSettings = DEFAULT_DEMO_SETTINGS,
): DemoAccount =>
  withStates(generateHangar(catalog, key, settings.composition), catalog, key, settings.states);

/** Gives the generated pledges their states and orders (#176). */
export function withStates(
  generated: readonly DemoPledge[],
  catalog: DemoCatalog,
  key: string,
  states: DemoStates = DEFAULT_DEMO_SETTINGS.states,
): DemoAccount {
  const random = createRandom(`${key}:states`);
  const byId = new Map(generated.map((pledge) => [pledge.id, pledge]));
  const set = (pledge: DemoPledge | undefined, change: (pledge: DemoPledge) => DemoPledge) => {
    if (pledge) byId.set(pledge.id, change(byId.get(pledge.id)!));
  };
  const upgradeLogs = new Map<number, UpgradeLogEntry[]>();

  // Melt and gift: spread, at least one of each.
  generated.forEach((pledge) => {
    if (pledge.demoKind === 'rewards') return;
    set(pledge, (current) => ({
      ...current,
      isGiftable:
        current.isGiftable && !random.chance(`gift:${pledge.id}`, states.notGiftablePercent / 100),
      isExchangeable: !random.chance(`melt:${pledge.id}`, states.notMeltablePercent / 100),
    }));
  });
  // The newest pledge (a paint, see `generateHangar`) can be melted: it was bought a few hours ago.
  set(generated[0], (pledge) => ({ ...pledge, isExchangeable: true }));
  const anyPaint = ofKind(generated, 'paints');
  set(anyPaint[1], (pledge) => ({ ...pledge, isGiftable: false }));
  set(anyPaint[2], (pledge) => ({ ...pledge, isGiftable: true, isExchangeable: true }));
  set(ofKind(generated, 'gear')[0], (pledge) => ({ ...pledge, isExchangeable: false }));

  // Insurances of the ships: LTI, years and months.
  ofKind(generated, 'ships').forEach((pledge, index) =>
    set(pledge, (current) => withInsurances(current, [INSURANCES[index % INSURANCES.length]!])),
  );
  // CCUs that bring an insurance.
  ofKind(generated, 'ccus')
    .slice(0, 3)
    .forEach((pledge, index) =>
      set(pledge, (current) => {
        const extra: UpgradeTarget = {
          id: DEMO.idBase - 90_000 - index,
          name: INSURANCES[index + 1]!,
        };
        return {
          ...current,
          upgrade: { ...current.upgrade!, targetItems: [...current.upgrade!.targetItems, extra] },
        };
      }),
    );

  // Upgraded ships with their applied CCUs.
  ofKind(generated, 'ships')
    .slice(states.upgraded ? -DEMO.upgradedPledges : generated.length)
    .forEach((pledge, index) => {
      const result = upgraded(byId.get(pledge.id)!, catalog, random, index);
      byId.set(pledge.id, result.pledge);
      if (result.log.length) upgradeLogs.set(pledge.id, result.log);
    });

  // Protected game access: SC, SQ42 and both, and a reward without a ship.
  if (states.protectedAccess) {
    const packages = ofKind(generated, 'packages');
    set(packages[0], (pledge) => protectedFor(pledge, ['SC']));
    set(packages[1], (pledge) => protectedFor(pledge, ['SQ42']));
    set(packages[2], (pledge) => protectedFor(pledge, ['SC', 'SQ42']));
    set(ofKind(generated, 'rewards')[0], (pledge) => ({
      ...pledge,
      title: 'VIP High Admiral',
      name: 'VIP High Admiral',
      items: [{ title: 'VIP High Admiral' }],
      protectedGames: ['SC'],
    }));
  }

  // A paint bought again with more discount (#139, #131): an old copy at its full price, a newer
  // one at the best tier; the demo's kept plan confirms it (`demo-consultant.ts`).
  const paints = ofKind(generated, 'paints');
  const [copy, old] = [paints[1], paints.at(-1)];
  if (copy && old && copy !== old) {
    const source = byId.get(old.id)!;
    set(old, (pledge) => ({
      ...pledge,
      value: usdText(pledge.standardPrice),
      valueUsd: pledge.standardPrice,
      isExchangeable: true,
      isGiftable: false,
    }));
    set(copy, (pledge) => {
      const value = Math.round(source.standardPrice * 0.65 * 100) / 100;
      return {
        ...pledge,
        title: source.title,
        name: source.title,
        items: source.items,
        image: source.image,
        standardPrice: source.standardPrice,
        value: usdText(value),
        valueUsd: value,
        isExchangeable: true,
        isGiftable: false,
      };
    });
  }

  const pledges = generated.map((pledge) => byId.get(pledge.id)!);
  return { pledges, orders: ordersOf(pledges, random), upgradeLogs };
}

/**
 * The invoice of a generated order, as the order details show it (#176): made-up id, the
 * pledge's title and amounts, the dummy billing address and payment provider.
 */
export function demoOrderDetails(
  order: Order,
  titles: readonly string[],
  total: number,
): OrderDetails {
  const credits = order.creditsUsed ?? usdText(0);
  return {
    id: order.id,
    slug: order.id.toLowerCase(),
    header: [
      { label: 'Order Placed', value: order.placedAt ?? '' },
      { label: 'Amount', value: order.amount },
      { label: 'Order Id', value: order.id },
      { label: 'Status', value: 'Paid' },
      { label: 'Payment', value: DEMO_PROCESSOR },
      { label: 'Fulfillment', value: 'Delivered' },
    ],
    items: {
      columns: ['Item', 'Price'],
      rows: titles.map((title, index) => [title, index ? '' : usdText(total)]),
    },
    billTo: [...DEMO_BILL_TO],
    totals: [
      { label: 'Items', value: usdText(total) },
      { label: 'Credits used', value: credits },
      { label: 'Total', value: order.amount },
    ],
    payments: { columns: ['Processor', 'Amount'], rows: [[DEMO_PROCESSOR, order.amount]] },
  };
}

import { MELT_COOLDOWN_MS } from '@/config';
import { meltableAt } from '@/hangar/melt-marks';
import type { StoreItem } from '../items/store-items';
import {
  dayOf,
  planPaintRebuy,
  planPendingRebuy,
  storePaintsOf,
  type PaintPledge,
  type PaintTier,
  type StorePaint,
} from './calculation';
import { cartCheckOf, type CartCheck, type CartLine, type PaintCartLine } from './cart';
import { paintSkuOf, skuByNameOf, type HangarPledge } from './filler-purchase';
import type { PlanWay, StoredOwnPaint, StoredRebuyPlan } from './rebuy-plan-storage';

/*
 * The running plan of the Paint Discount Consultant as ordered steps (#245), worked out from the
 * stored plan, the hangar, the Pledge Store, the store credit and RSI's cart – pure, so every
 * state can be tested. "Buy first" (way 1) has three steps: buy the paints (with the cart and the
 * store credit checked before paying), melt the old paints, melt the filler paints. "Melt first"
 * (way 2) has four: melt the own paints, fill the cart and check it, pay with store credit, melt
 * the filler paints. A plan without fillers has no fillers step.
 *
 * Each step is judged on its own, so a plan done out of order (e.g. paid before melting in way 2)
 * still shows what is left. Every open step that can be done now is `current` – the fillers can
 * be ready while old paints are still left to melt –, and exactly one step, the earliest open one,
 * is `ariaCurrent`. The view holds data only: kinds, ids and numbers the UI turns into texts.
 */

export type RunStepKind = 'buy' | 'meltOld' | 'meltOwn' | 'cart' | 'pay' | 'fillers';
export type RunStepState = 'done' | 'current' | 'next' | 'wait';

/** RSI's cart as last read: not yet, its lines, or why it couldn't be read. */
export type CartState =
  | { status: 'unread' }
  | {
      status: 'read';
      lines: readonly CartLine[];
      at: number;
      /** Read empty after it held the whole plan: probably just paid, the order comes later. */
      emptiedAfterComplete?: boolean;
    }
  | { status: 'failed'; reason: string; at: number };

/**
 * A step's status on the right: `paid`/`melted` with the time (`at`, ms) or day ("2026-11-12")
 * where known, `readyAt` the end of RSI's cooldown, `afterPurchase` waits for the order to show,
 * `after24h` for the cooldown after paying, `checking` for the order after the cart was paid.
 */
export interface RunStatus {
  kind:
    | 'now'
    | 'next'
    | 'checked'
    | 'checking'
    | 'paid'
    | 'melted'
    | 'readyAt'
    | 'afterPurchase'
    | 'after24h';
  at?: number;
  day?: string;
}

/**
 * A check in a step's body; `ok` undefined while it can't be told. Its values by kind:
 * - `cart`: inCart, total, missing (paints), cost (USD), percent (tier)
 * - `cartUnknown`: the cart wasn't read yet; `cartUnread`: reason (RSI's error)
 * - `otherItems`: count – items beyond the plan; they change the tier
 * - `credit`: credit, cost, left (after paying) or missing; `creditUnknown`: cost
 * - `price`: cost now, planned – the store's prices changed
 * - `unavailable`: count, names (", ") – no longer sold on their own
 * - `cooldownOver`: since (ms); `notMeltable`: count, names – can't be melted (game access)
 */
export interface RunCheck {
  kind:
    | 'cart'
    | 'cartUnknown'
    | 'cartUnread'
    | 'otherItems'
    | 'credit'
    | 'creditUnknown'
    | 'price'
    | 'unavailable'
    | 'cooldownOver'
    | 'notMeltable';
  ok: boolean | undefined;
  values: Record<string, number | string>;
}

/**
 * A paint row: `ok` (in the cart / melted), `missing` (not in the cart, not sold, can't be
 * melted – see `reason`), `melt` (to melt now), `wait` (waits for RSI's cooldown, or the cart isn't
 * read yet). In cart rows `was` is the standard price of the row and `value` what it costs in the
 * cart; in melt rows `value` is what melting the row gives, and for fillers `was` what one of
 * them melts for.
 */
export interface RunPaintRow {
  key: string;
  state: 'ok' | 'missing' | 'melt' | 'wait';
  reason?: 'notInCart' | 'unavailable' | 'notMeltable' | 'cartUnknown';
  skuId: number;
  name: string;
  count: number;
  was?: number;
  value: number;
  filler: boolean;
  /** The pledges of the row, for melting (none for cart rows). */
  pledgeIds: number[];
}

/**
 * The note below a step's checks: `afterPay` – the order is found on the next refresh;
 * `purchaseNextRefresh` – the cart was emptied, probably paid; `creditSpent` – store credit was
 * spent since the start, recalculate; `onlyOldCopies` (day) – only the copies bought before it are
 * melted; `notFound` (days) – no order showed within them, the plan can be discarded;
 * `priceChanged`; `unavailable`; `cartUnread`.
 */
export interface RunNote {
  kind:
    | 'afterPay'
    | 'purchaseNextRefresh'
    | 'creditSpent'
    | 'onlyOldCopies'
    | 'notFound'
    | 'priceChanged'
    | 'unavailable'
    | 'cartUnread';
  values: Record<string, number | string>;
}

/**
 * What a step offers. `cta` is the step's main button, `ghost` a secondary one before it. `melt`
 * with `bulk: false` is today's "Bulk melting is off" button. `pay` and `openCart` open RSI's
 * cart; `fillCart` puts only the missing lines into it. All disabled in the demo, but `recalculate`
 * and `discard`, which change the demo's own plan only.
 */
export type RunAction =
  | { kind: 'fillCart'; role: 'cta'; enabled: boolean; lines: PaintCartLine[]; count: number }
  | { kind: 'pay'; role: 'cta'; enabled: boolean; amount: number }
  | { kind: 'openCart'; role: 'cta'; enabled: boolean }
  | {
      kind: 'melt';
      role: 'cta';
      target: 'own' | 'old' | 'fillers';
      enabled: boolean;
      pledgeIds: number[];
      amount: number;
      bulk: boolean;
    }
  | {
      kind: 'readCart' | 'readCredit' | 'recalculate' | 'discard';
      role: 'ghost';
      enabled: boolean;
    };

export interface RunStepBody {
  /** RSI's 24-hour cooldown: when it ends and started, in ms. */
  countdown?: { endsAt: number; startedAt: number };
  checks: RunCheck[];
  paints: RunPaintRow[];
  note?: RunNote;
  actions: RunAction[];
}

export interface RunStep {
  kind: RunStepKind;
  state: RunStepState;
  /** The earliest open step: the one with `aria-current="step"`. */
  ariaCurrent: boolean;
  /** Paints the step is about (for its title), and their names (for its sub-line). */
  count: number;
  names: string[];
  /** What the step changes the store credit by, in USD; `signed: false` for the cart's total. */
  amount: number;
  signed: boolean;
  /** Of it, what is done already (melted so far). */
  amountDone?: number;
  status: RunStatus;
  /** Only for steps that can be done now, and for the earliest open one. */
  body?: RunStepBody;
}

export interface RunningPlanView {
  way: PlanWay;
  /** When it started, in ms. */
  since: number;
  tier: PaintTier;
  ownCount: number;
  fillerCount: number;
  /** Store credit the plan gains once done, in USD. */
  result: number;
  cartCost: number;
  creditAtStart?: number;
  steps: RunStep[];
  doneCount: number;
  /** Index of the `ariaCurrent` step; -1 when everything is done. */
  currentIndex: number;
  complete: boolean;
  /** A step needs RSI's cart: it is read while the Pledge Store tab is shown. */
  needsCart: boolean;
}

export interface RunningPlanInput {
  plan: StoredRebuyPlan;
  /** The hangar's pledges (the demo's in the demo mode). */
  pledges: readonly PaintPledge[];
  storeItems: readonly StoreItem[] | undefined;
  /** The account's store credit in USD, whatever the setting "use store credit" says. */
  credit: number | undefined;
  cart: CartState;
  bulkMelting: boolean;
  useFillers: boolean;
  demo: boolean;
  now: number;
}

const cents = (usd: number) => Math.round(usd * 100);
const usd = (cents: number) => cents / 100;
/** What a price in cents costs after the tier's discount, in cents. */
const keep = (price: number, tier: PaintTier) => Math.round((price * (100 - tier.percent)) / 100);

// ---- Progress: what of the plan is done, from the stored facts and the hangar ----

export interface OwnProgress<P extends HangarPledge = PaintPledge> {
  paint: StoredOwnPaint;
  /** The old pledge while it is in the hangar. */
  pledge?: P;
  /** Its new copy, once bought. */
  copyId?: number;
  /** What melting it gives (or gave), in USD. */
  value: number;
}

export interface FillerProgress<P extends HangarPledge = PaintPledge> {
  pledgeId: number;
  skuId?: number;
  /** The pledge while it is in the hangar. */
  pledge?: P;
}

export interface PlanProgress<P extends HangarPledge = PaintPledge> {
  own: OwnProgress<P>[];
  /** Every old pledge is gone from the hangar. */
  ownDone: boolean;
  /** The paints were bought: the order was found, or a new copy of every own paint is there. */
  bought: boolean;
  /** When, in ms, or the day of the copies without an order. */
  paidAt?: number;
  paidOn?: string;
  /** The filler pledges of the order (none before it was found). */
  fillers: FillerProgress<P>[];
  fillersDone: boolean;
  /** When RSI lets the fillers be melted, once the order is known. */
  fillersMeltableAt?: number;
  complete: boolean;
}

/** What of the plan is done. */
export function planProgress<P extends HangarPledge>(
  plan: StoredRebuyPlan,
  pledges: readonly P[],
  storeItems: readonly StoreItem[] | undefined,
): PlanProgress<P> {
  const byId = new Map(pledges.map((pledge) => [pledge.id, pledge]));
  const purchase = plan.purchase;
  const skuByName = skuByNameOf(plan, storeItems ?? []);
  const oldIds = new Set(plan.own.map((paint) => paint.pledgeId));

  // The new copies by SKU: the order's, or those bought since the plan's day.
  const copies = new Map<number, number[]>();
  const addCopy = (skuId: number | undefined, id: number) =>
    skuId !== undefined && copies.set(skuId, [...(copies.get(skuId) ?? []), id]);
  if (purchase?.ownPledgeIds) {
    for (const id of purchase.ownPledgeIds) {
      const pledge = byId.get(id);
      addCopy(purchase.skus?.[id] ?? (pledge && paintSkuOf(pledge, skuByName)), id);
    }
  } else {
    const since = dayOf(plan.at);
    const fillerIds = new Set(purchase?.pledgeIds ?? []);
    for (const pledge of [...pledges].sort((a, b) => a.id - b.id)) {
      if (oldIds.has(pledge.id) || fillerIds.has(pledge.id)) continue;
      if ((pledge.createdAt ?? '') < since) continue;
      addCopy(paintSkuOf(pledge, skuByName), pledge.id);
    }
  }
  const own = plan.own.map((paint): OwnProgress<P> => {
    const copyId = copies.get(paint.skuId)?.shift();
    const pledge = byId.get(paint.pledgeId);
    return {
      paint,
      ...(pledge && { pledge }),
      ...(copyId !== undefined && { copyId }),
      value: paint.freed ?? paint.meltValue,
    };
  });
  const ownDone = own.every((paint) => !paint.pledge);
  const bought = !!purchase || (!!own.length && own.every((paint) => paint.copyId !== undefined));
  const boughtAt = purchase?.boughtAt ? Date.parse(purchase.boughtAt) : NaN;
  const paidAt = purchase ? (Number.isNaN(boughtAt) ? purchase.foundAt : boughtAt) : undefined;
  const paidOn = bought
    ? own
        .map((paint) => paint.copyId !== undefined && byId.get(paint.copyId)?.createdAt)
        .filter((on): on is string => !!on)
        .sort()
        .at(-1)
    : undefined;

  const fillers = plan.fillers.length && purchase ? fillerProgress(plan, byId, skuByName) : [];
  const fillersDone = !plan.fillers.length || (!!purchase && fillers.every((f) => !f.pledge));
  const fillersMeltableAt = purchase
    ? meltableAt({ boughtAt: purchase.boughtAt, markedAt: purchase.foundAt })
    : undefined;
  return {
    own,
    ownDone,
    bought,
    ...(paidAt !== undefined && { paidAt }),
    ...(paidOn && { paidOn }),
    fillers,
    fillersDone,
    ...(plan.fillers.length && fillersMeltableAt !== undefined && { fillersMeltableAt }),
    complete: ownDone && bought && fillersDone,
  };
}

/** The filler pledges of the order with their SKU – kept with it, or the plan's order of them. */
function fillerProgress<P extends HangarPledge>(
  plan: StoredRebuyPlan,
  byId: ReadonlyMap<number, P>,
  skuByName: ReadonlyMap<string, number>,
): FillerProgress<P>[] {
  const purchase = plan.purchase!;
  const known = purchase.pledgeIds.map((pledgeId) => {
    const pledge = byId.get(pledgeId);
    const skuId = purchase.skus?.[pledgeId] ?? (pledge && paintSkuOf(pledge, skuByName));
    return { pledgeId, ...(skuId !== undefined && { skuId }), ...(pledge && { pledge }) };
  });
  // Without a SKU (kept before #245 and melted already): as many of each as the plan bought.
  const left = new Map(plan.fillers.map((filler) => [filler.skuId, filler.quantity]));
  for (const filler of known) {
    if (filler.skuId !== undefined) left.set(filler.skuId, (left.get(filler.skuId) ?? 0) - 1);
  }
  return known.map((filler) => {
    if (filler.skuId !== undefined) return filler;
    const skuId = [...left].find(([, count]) => count > 0)?.[0];
    if (skuId === undefined) return filler;
    left.set(skuId, left.get(skuId)! - 1);
    return { ...filler, skuId };
  });
}

// ---- The plan's cart ----

/** The names of the Pledge Store's items by SKU. */
const namesOf = (storeItems: readonly StoreItem[] | undefined) =>
  new Map((storeItems ?? []).map((item) => [item.id, item.name]));

/** The name of an own paint: the store's, or its pledge's title. */
const ownNameOf = (paint: StoredOwnPaint, names: ReadonlyMap<number, string>) =>
  names.get(paint.skuId) ?? paint.title;

/** The plan's paints as cart lines: own paints of the same SKU together, then the fillers. */
export function planLinesOf(
  plan: Pick<StoredRebuyPlan, 'own' | 'fillers'>,
  storeItems?: readonly StoreItem[],
): PaintCartLine[] {
  const names = namesOf(storeItems);
  const lines = new Map<number, PaintCartLine>();
  const add = (skuId: number, name: string, qty: number) => {
    const line = lines.get(skuId);
    if (line) line.qty += qty;
    else lines.set(skuId, { skuId, name, qty });
  };
  for (const paint of plan.own) add(paint.skuId, ownNameOf(paint, names), 1);
  for (const filler of plan.fillers) add(filler.skuId, filler.name, filler.quantity);
  return [...lines.values()];
}

/** What the plan's own paints cost in its cart, in cents. */
function ownInCartOf(plan: StoredRebuyPlan, store: ReadonlyMap<number, StorePaint>): number {
  const prices = plan.own.map((paint) => paint.price ?? store.get(paint.skuId)?.price);
  if (prices.every((price) => price !== undefined)) {
    return keep(
      prices.reduce((sum, price) => sum + cents(price!), 0),
      plan.tier,
    );
  }
  // Prices not kept (version 1) and not sold any more: the rest of the cart after the fillers.
  const fillers = plan.fillers.reduce((sum, f) => sum + cents(f.price) * f.quantity, 0);
  return cents(plan.cartCost) - keep(fillers, plan.tier);
}

/** Store credit the plan gains once done: its own paints' melt value minus their new price. */
export function planResultOf(plan: StoredRebuyPlan, storeItems?: readonly StoreItem[]): number {
  const store = new Map(storePaintsOf(storeItems ?? []).map((paint) => [paint.id, paint]));
  const melt = plan.own.reduce((sum, paint) => sum + cents(paint.freed ?? paint.meltValue), 0);
  return usd(melt - ownInCartOf(plan, store));
}

interface CartReview {
  check?: CartCheck;
  checks: RunCheck[];
  paints: RunPaintRow[];
  /** The cart holds exactly the plan. */
  matches: boolean;
  /** Whether the store credit pays the cart; undefined while unknown. */
  creditOk: boolean | undefined;
  /** What the cart costs at today's prices, in USD. */
  cost: number;
  priceChanged: boolean;
  unavailable: string[];
}

/** RSI's cart and the store credit compared with the plan. */
function reviewCart(input: RunningPlanInput): CartReview {
  const { plan, cart, credit } = input;
  const store = new Map(storePaintsOf(input.storeItems ?? []).map((paint) => [paint.id, paint]));
  const lines = planLinesOf(plan, input.storeItems);
  const storedPrice = new Map<number, number | undefined>();
  for (const paint of plan.own) storedPrice.set(paint.skuId, paint.price);
  for (const filler of plan.fillers) storedPrice.set(filler.skuId, filler.price);
  const priceOf = (skuId: number) => store.get(skuId)?.price ?? storedPrice.get(skuId);

  const unavailableLines = input.storeItems ? lines.filter((line) => !store.has(line.skuId)) : [];
  const unavailable = unavailableLines.map((line) => line.name);
  const prices = lines.map((line) => priceOf(line.skuId));
  const known = prices.every((price) => price !== undefined);
  const costCents = known
    ? keep(
        lines.reduce((sum, line, i) => sum + cents(prices[i]!) * line.qty, 0),
        plan.tier,
      )
    : cents(plan.cartCost);
  const priceChanged =
    !!input.storeItems && known && !unavailable.length && costCents !== cents(plan.cartCost);
  const cost = usd(costCents);

  const check = cart.status === 'read' ? cartCheckOf(lines, cart.lines) : undefined;
  const checks: RunCheck[] = [];
  if (cart.status === 'failed') {
    checks.push({ kind: 'cartUnread', ok: undefined, values: { reason: cart.reason } });
  } else if (!check) {
    checks.push({ kind: 'cartUnknown', ok: undefined, values: {} });
  } else {
    checks.push({
      kind: 'cart',
      ok: check.complete,
      values: {
        inCart: check.inCart,
        total: check.total,
        missing: check.total - check.inCart,
        cost,
        percent: plan.tier.percent,
      },
    });
    if (check.others)
      checks.push({ kind: 'otherItems', ok: false, values: { count: check.others } });
  }
  const creditOk = credit === undefined ? undefined : cents(credit) >= costCents;
  checks.push(
    credit === undefined
      ? { kind: 'creditUnknown', ok: undefined, values: { cost } }
      : {
          kind: 'credit',
          ok: creditOk,
          values: {
            credit,
            cost,
            ...(creditOk
              ? { left: usd(cents(credit) - costCents) }
              : { missing: usd(costCents - cents(credit)) }),
          },
        },
  );
  if (priceChanged) {
    checks.push({ kind: 'price', ok: false, values: { cost, planned: plan.cartCost } });
  }
  if (unavailable.length) {
    checks.push({
      kind: 'unavailable',
      ok: false,
      values: { count: unavailable.length, names: unavailable.join(', ') },
    });
  }

  const fillerSkus = new Set(plan.fillers.map((filler) => filler.skuId));
  const ownSkus = new Set(plan.own.map((paint) => paint.skuId));
  const paints = (check?.lines ?? lines.map((line) => ({ line, inCart: 0 }))).map(
    ({ line, inCart }): RunPaintRow => {
      const price = priceOf(line.skuId);
      const gone = !!input.storeItems && !store.has(line.skuId);
      const state = gone ? 'missing' : !check ? 'wait' : inCart < line.qty ? 'missing' : 'ok';
      return {
        key: `cart-${line.skuId}`,
        state,
        ...(gone
          ? { reason: 'unavailable' as const }
          : !check
            ? { reason: 'cartUnknown' as const }
            : inCart < line.qty && { reason: 'notInCart' as const }),
        skuId: line.skuId,
        name: line.name,
        count: line.qty,
        ...(price !== undefined && { was: usd(cents(price) * line.qty) }),
        value: price === undefined ? 0 : usd(keep(cents(price) * line.qty, plan.tier)),
        // A SKU both own and filler counts as own: the copy is what matters.
        filler: fillerSkus.has(line.skuId) && !ownSkus.has(line.skuId),
        pledgeIds: [],
      };
    },
  );
  return {
    ...(check && { check }),
    checks,
    paints,
    matches: !!check?.matches,
    creditOk,
    cost,
    priceChanged,
    unavailable,
  };
}

// ---- The steps ----

/** The running plan as ordered steps. */
export function runningPlanSteps(input: RunningPlanInput): RunningPlanView {
  const { plan, now, demo } = input;
  const names = namesOf(input.storeItems);
  const progress = planProgress(plan, input.pledges, input.storeItems);
  const store = new Map(storePaintsOf(input.storeItems ?? []).map((paint) => [paint.id, paint]));
  const ownInCart = ownInCartOf(plan, store);
  const fillerMeltCents = plan.fillers.length ? cents(plan.cartCost) - ownInCart : 0;
  const fillerCount = plan.fillers.reduce((sum, filler) => sum + filler.quantity, 0);
  const cart = reviewCart(input);
  const emptied = input.cart.status === 'read' && !!input.cart.emptiedAfterComplete;
  const notFound = !progress.bought && plan.checkEndedAt !== undefined;
  // Once paid, the planned cost is what it cost; before, what the store asks now.
  const payAmount = progress.bought ? plan.cartCost : cart.cost;

  const recalculation = needsRecalculation(cart)
    ? recalculatedPlan(plan, {
        pledges: input.pledges,
        storeItems: input.storeItems,
        credit: input.credit,
        useFillers: input.useFillers,
        now,
      })
    : undefined;

  // ---- The parts of the steps ----

  const ownRows = (): RunPaintRow[] =>
    progress.own.map((own) => {
      const state = !own.pledge ? 'ok' : own.pledge.isMeltable ? 'melt' : 'missing';
      return {
        key: `own-${own.paint.pledgeId}`,
        state,
        ...(state === 'missing' && { reason: 'notMeltable' as const }),
        skuId: own.paint.skuId,
        name: ownNameOf(own.paint, names),
        count: 1,
        value: own.value,
        filler: false,
        pledgeIds: [own.paint.pledgeId],
      };
    });
  const ownLeft = progress.own.filter((own) => own.pledge);
  const ownMeltable = ownLeft.filter((own) => own.pledge!.isMeltable);
  const ownTotal = usd(progress.own.reduce((sum, own) => sum + cents(own.value), 0));
  const ownDoneAmount = usd(
    progress.own.filter((own) => !own.pledge).reduce((sum, own) => sum + cents(own.value), 0),
  );
  const meltedAt = (times: (number | undefined)[]) => {
    const known = times.filter((at): at is number => at !== undefined);
    return known.length ? Math.max(...known) : undefined;
  };
  const notMeltable = ownLeft.filter((own) => !own.pledge!.isMeltable);
  const notMeltableCheck: RunCheck[] = notMeltable.length
    ? [
        {
          kind: 'notMeltable',
          ok: false,
          values: {
            count: notMeltable.length,
            names: notMeltable.map((own) => ownNameOf(own.paint, names)).join(', '),
          },
        },
      ]
    : [];

  const meltOwnAction = (target: 'own' | 'old'): RunAction => ({
    kind: 'melt',
    role: 'cta',
    target,
    enabled: !demo && !!ownMeltable.length,
    pledgeIds: ownMeltable.map((own) => own.paint.pledgeId),
    amount: usd(ownMeltable.reduce((sum, own) => sum + cents(own.value), 0)),
    bulk: input.bulkMelting,
  });

  /** The cart's checks, rows and buttons, before paying. */
  const cartBody = (withPay: boolean): RunStepBody => {
    const actions: RunAction[] = [];
    const ghost = (kind: 'readCart' | 'readCredit' | 'recalculate' | 'discard', enabled = true) =>
      actions.push({ kind, role: 'ghost', enabled });
    if (input.cart.status === 'failed') ghost('readCart', !demo);
    if (input.credit === undefined) ghost('readCredit', !demo);
    if (needsRecalculation(cart)) ghost('recalculate', !!recalculation);
    if (notFound) ghost('discard');
    const missing = cart.check?.missing.filter((line) => !cart.unavailable.includes(line.name));
    if (input.cart.status === 'failed' || cart.check?.others) {
      actions.push({ kind: 'openCart', role: 'cta', enabled: !demo });
    } else if (missing?.length) {
      actions.push({
        kind: 'fillCart',
        role: 'cta',
        enabled: !demo,
        lines: missing,
        count: missing.reduce((sum, line) => sum + line.qty, 0),
      });
    } else if (cart.matches || withPay) {
      actions.push({
        kind: 'pay',
        role: 'cta',
        enabled: !demo && cart.matches && cart.creditOk !== false,
        amount: cart.cost,
      });
    }
    const note: RunNote | undefined = notFound
      ? { kind: 'notFound', values: { days: Math.floor((now - plan.at) / 86_400_000) } }
      : emptied
        ? { kind: 'purchaseNextRefresh', values: {} }
        : cart.creditOk === false
          ? { kind: 'creditSpent', values: {} }
          : cart.unavailable.length
            ? { kind: 'unavailable', values: { names: cart.unavailable.join(', ') } }
            : cart.priceChanged
              ? { kind: 'priceChanged', values: { cost: cart.cost, planned: plan.cartCost } }
              : input.cart.status === 'failed'
                ? { kind: 'cartUnread', values: { reason: input.cart.reason } }
                : cart.matches
                  ? { kind: 'afterPay', values: {} }
                  : undefined;
    return { checks: cart.checks, paints: cart.paints, ...(note && { note }), actions };
  };

  // ---- Each step on its own ----

  interface Draft extends Omit<RunStep, 'state' | 'ariaCurrent' | 'body'> {
    done: boolean;
    /** Can be done now. */
    actionable: boolean;
    /** Time-gated: waits for RSI's cooldown. */
    waiting?: boolean;
    body?: () => RunStepBody;
  }

  const ownCount = plan.own.length;
  const ownNames = plan.own.map((paint) => ownNameOf(paint, names));
  const allNames = [...ownNames, ...plan.fillers.map((filler) => filler.name)];
  const paid: RunStatus = {
    kind: 'paid',
    ...(progress.paidAt !== undefined && { at: progress.paidAt }),
    ...(progress.paidOn && { day: progress.paidOn }),
  };

  const meltStep = (kind: 'meltOld' | 'meltOwn', actionable: boolean): Draft => ({
    kind,
    done: progress.ownDone,
    actionable: actionable && !!ownLeft.length,
    count: ownCount,
    names: ownNames,
    amount: ownTotal,
    signed: true,
    ...(ownDoneAmount && !progress.ownDone && { amountDone: ownDoneAmount }),
    status: progress.ownDone
      ? {
          kind: 'melted',
          ...(meltedAt(plan.own.map((paint) => paint.meltedAt)) !== undefined && {
            at: meltedAt(plan.own.map((paint) => paint.meltedAt)),
          }),
        }
      : actionable
        ? { kind: 'now' }
        : { kind: 'next' },
    body: () => ({
      checks: notMeltableCheck,
      paints: ownRows(),
      ...(kind === 'meltOld' && {
        note: {
          kind: 'onlyOldCopies' as const,
          values: { day: progress.paidOn ?? dayOf(progress.paidAt ?? plan.at) },
        },
      }),
      actions: [meltOwnAction(kind === 'meltOld' ? 'old' : 'own')],
    }),
  });

  const fillersStep = (): Draft | undefined => {
    if (!plan.fillers.length) return undefined;
    const left = progress.fillers.filter((filler) => filler.pledge);
    const readyAt = progress.fillersMeltableAt;
    const known = !!plan.purchase;
    const waiting = known && !!left.length && readyAt !== undefined && now < readyAt;
    const ready = known && !!left.length && !waiting;
    const unit = (skuId: number) => {
      const filler = plan.fillers.find((f) => f.skuId === skuId);
      return filler ? usd(keep(cents(filler.price), plan.tier)) : 0;
    };
    const meltedCount = progress.fillers.length - left.length;
    const rows = (): RunPaintRow[] =>
      plan.fillers.flatMap((filler) => {
        const ofSku = progress.fillers.filter((f) => f.skuId === filler.skuId);
        const present = ofSku.filter((f) => f.pledge);
        const gone = ofSku.filter((f) => !f.pledge);
        const row = (state: RunPaintRow['state'], of: FillerProgress[]): RunPaintRow => ({
          key: `filler-${filler.skuId}-${state}`,
          state,
          skuId: filler.skuId,
          name: filler.name,
          count: of.length,
          was: unit(filler.skuId),
          value: usd(cents(unit(filler.skuId)) * of.length),
          filler: true,
          pledgeIds: of.map((f) => f.pledgeId),
        });
        return [
          ...(gone.length ? [row('ok', gone)] : []),
          ...(present.length ? [row(waiting ? 'wait' : 'melt', present)] : []),
        ];
      });
    const meltable = left.filter((filler) => filler.pledge!.isMeltable);
    const action: RunAction = {
      kind: 'melt',
      role: 'cta',
      target: 'fillers',
      enabled: !demo && ready && !!meltable.length,
      pledgeIds: meltable.map((filler) => filler.pledgeId),
      amount: usd(meltable.reduce((sum, f) => sum + cents(unit(f.skuId ?? -1)), 0)),
      bulk: input.bulkMelting,
    };
    const fillerDone = usd(
      progress.fillers
        .filter((f) => !f.pledge)
        .reduce((sum, f) => sum + cents(unit(f.skuId ?? -1)), 0),
    );
    return {
      kind: 'fillers',
      done: progress.fillersDone,
      actionable: ready,
      waiting,
      count: fillerCount,
      names: plan.fillers.map((filler) => filler.name),
      amount: usd(fillerMeltCents),
      signed: true,
      ...(meltedCount && !progress.fillersDone && { amountDone: fillerDone }),
      status: progress.fillersDone
        ? {
            kind: 'melted',
            ...(meltedAt(Object.values(plan.fillersMelted ?? {})) !== undefined && {
              at: meltedAt(Object.values(plan.fillersMelted ?? {})),
            }),
          }
        : waiting
          ? { kind: 'readyAt', at: readyAt! }
          : ready
            ? { kind: 'now' }
            : progress.bought
              ? { kind: 'afterPurchase' }
              : { kind: 'after24h' },
      body: () => ({
        ...(waiting && { countdown: { endsAt: readyAt!, startedAt: readyAt! - MELT_COOLDOWN_MS } }),
        checks:
          ready && readyAt !== undefined
            ? [{ kind: 'cooldownOver' as const, ok: true, values: { since: readyAt } }]
            : [],
        paints: rows(),
        actions: [action],
      }),
    };
  };

  const drafts: Draft[] = [];
  if (plan.way === 'buy') {
    drafts.push({
      kind: 'buy',
      done: progress.bought,
      actionable: !progress.bought,
      count: ownCount + fillerCount,
      names: allNames,
      amount: -payAmount,
      signed: true,
      status: progress.bought ? paid : emptied ? { kind: 'checking' } : { kind: 'now' },
      body: () => cartBody(false),
    });
    drafts.push(meltStep('meltOld', progress.bought));
  } else {
    drafts.push(meltStep('meltOwn', true));
    const cartDone = progress.bought || emptied || (cart.matches && cart.creditOk !== false);
    drafts.push({
      kind: 'cart',
      done: cartDone,
      actionable: !cartDone && progress.ownDone,
      count: ownCount + fillerCount,
      names: allNames,
      amount: payAmount,
      signed: false,
      status: cartDone
        ? { kind: 'checked' }
        : progress.ownDone
          ? { kind: 'now' }
          : { kind: 'next' },
      body: () => cartBody(true),
    });
    drafts.push({
      kind: 'pay',
      done: progress.bought,
      actionable: !progress.bought && cartDone,
      count: ownCount + fillerCount,
      names: allNames,
      amount: -payAmount,
      signed: true,
      status: progress.bought
        ? paid
        : emptied
          ? { kind: 'checking' }
          : cartDone
            ? { kind: 'now' }
            : { kind: 'next' },
      body: () => cartBody(true),
    });
  }
  const fillers = fillersStep();
  if (fillers) drafts.push(fillers);

  const currentIndex = drafts.findIndex((draft) => !draft.done);
  const steps = drafts.map(({ done, actionable, waiting, body, ...step }, i): RunStep => {
    const state: RunStepState = done ? 'done' : actionable ? 'current' : waiting ? 'wait' : 'next';
    const ariaCurrent = i === currentIndex;
    const withBody = state === 'current' || (state === 'wait' && ariaCurrent);
    return { ...step, state, ariaCurrent, ...(withBody && body && { body: body() }) };
  });

  const buyOpen = !progress.bought && !emptied;
  return {
    way: plan.way,
    since: plan.at,
    tier: plan.tier,
    ownCount,
    fillerCount,
    result: planResultOf(plan, input.storeItems),
    cartCost: plan.cartCost,
    ...(plan.creditAtStart !== undefined && { creditAtStart: plan.creditAtStart }),
    steps,
    doneCount: steps.filter((step) => step.state === 'done').length,
    currentIndex,
    complete: progress.complete,
    needsCart: buyOpen && (plan.way === 'buy' || progress.ownDone),
  };
}

/** The cart no longer fits the store credit or the store: worked out again on request. */
const needsRecalculation = (cart: CartReview) =>
  cart.creditOk === false || cart.priceChanged || !!cart.unavailable.length;

// ---- Facts and changes of the stored plan ----

/**
 * The plan worked out again for the store credit there is now ("Recalculate", #245), before
 * paying; none when no tier fits. "Melt first", once the own paints are melted: the tier the store
 * credit pays for them now, as for paints left to buy (#168) – the melted paints stay. "Buy
 * first": the best tier the store credit pays before melting, from the plan's own paints only.
 * Paints no longer sold on their own leave the plan. The cart itself is never changed.
 */
export function recalculatedPlan(
  plan: StoredRebuyPlan,
  input: {
    pledges: readonly PaintPledge[];
    storeItems: readonly StoreItem[] | undefined;
    credit: number | undefined;
    useFillers: boolean;
    now: number;
  },
): StoredRebuyPlan | undefined {
  const { storeItems, credit } = input;
  if (!storeItems || credit === undefined || plan.purchase) return undefined;
  const fillersOf = (fillers: { paint: StorePaint; quantity: number }[]) =>
    fillers.map((filler) => ({
      skuId: filler.paint.id,
      name: filler.paint.name,
      quantity: filler.quantity,
      price: filler.paint.price,
    }));
  const changed = { recalculatedAt: input.now, previousTier: { ...plan.tier } };

  if (plan.way === 'melt') {
    const inHangar = new Set(input.pledges.map((pledge) => pledge.id));
    if (plan.own.some((paint) => inHangar.has(paint.pledgeId))) return undefined;
    const pending = planPendingRebuy({
      kept: plan,
      pledges: input.pledges,
      storeItems,
      storeCredit: credit,
      useFillers: input.useFillers,
    });
    if (!pending?.plan) return undefined;
    const toBuy = new Map(pending.toBuy.map((paint) => [paint.pledgeId, paint.storePaint]));
    return {
      ...plan,
      ...changed,
      tier: { ...pending.plan.tier },
      own: plan.own
        .filter((paint) => toBuy.has(paint.pledgeId))
        .map((paint) => ({ ...paint, price: toBuy.get(paint.pledgeId)!.price })),
      fillers: fillersOf(pending.plan.fillers),
      cartCost: pending.plan.cartCost,
    };
  }

  // Before melting only: a paint melted already would be lost from the plan.
  const ownIds = new Set(plan.own.map((paint) => paint.pledgeId));
  const present = input.pledges.filter((pledge) => ownIds.has(pledge.id));
  if (present.length < ownIds.size) return undefined;
  const result = planPaintRebuy({
    pledges: present,
    storeItems,
    storeCredit: credit,
    useFillers: input.useFillers,
    skipGiftable: false,
  });
  const buyFirst = result.buyFirst;
  if (!buyFirst) return undefined;
  return {
    ...plan,
    ...changed,
    tier: { ...buyFirst.tier },
    own: buyFirst.own.map((paint) => ({
      ...plan.own.find((own) => own.pledgeId === paint.pledgeId)!,
      meltValue: paint.meltValue,
      price: paint.storePaint.price,
    })),
    fillers: fillersOf(buyFirst.fillers),
    cartCost: buyFirst.cartCost,
  };
}

/**
 * The plan with pledges melted in the bulk melting (`BulkExchangeOverlay`'s `exchanged`): when,
 * and for how much (their value right before). Replaces a time only seen; the same plan when
 * none of them is the plan's.
 */
export function withMelted(
  plan: StoredRebuyPlan,
  ids: readonly number[],
  values: ReadonlyMap<number, number>,
  now: number,
): StoredRebuyPlan {
  const melted = new Set(ids);
  let changed = false;
  const own = plan.own.map((paint) => {
    if (!melted.has(paint.pledgeId) || (paint.meltedAt !== undefined && !paint.seenGone)) {
      return paint;
    }
    changed = true;
    const next: StoredOwnPaint = { ...paint, meltedAt: now };
    delete next.seenGone;
    const freed = values.get(paint.pledgeId);
    return freed === undefined ? next : { ...next, freed };
  });
  const fillerIds = (plan.purchase?.pledgeIds ?? []).filter((id) => melted.has(id));
  const fillersMelted = { ...plan.fillersMelted };
  for (const id of fillerIds) {
    if (fillersMelted[id] !== undefined) continue;
    fillersMelted[id] = now;
    changed = true;
  }
  return changed
    ? { ...plan, own, ...(Object.keys(fillersMelted).length && { fillersMelted }) }
    : plan;
}

/**
 * The plan with its pledges gone from the hangar noted, where the bulk melting didn't tell it:
 * the time is when that was seen (`seenGone`), what it gave the plan's melt value. The same plan
 * when nothing is new.
 */
export function withSeenGone(
  plan: StoredRebuyPlan,
  pledges: readonly Pick<PaintPledge, 'id'>[],
  now: number,
): StoredRebuyPlan {
  const inHangar = new Set(pledges.map((pledge) => pledge.id));
  let changed = false;
  const own = plan.own.map((paint) => {
    if (inHangar.has(paint.pledgeId) || paint.meltedAt !== undefined) return paint;
    changed = true;
    return { ...paint, meltedAt: now, seenGone: true };
  });
  const fillersMelted = { ...plan.fillersMelted };
  for (const id of plan.purchase?.pledgeIds ?? []) {
    if (inHangar.has(id) || fillersMelted[id] !== undefined) continue;
    fillersMelted[id] = now;
    changed = true;
  }
  return changed
    ? { ...plan, own, ...(Object.keys(fillersMelted).length && { fillersMelted }) }
    : plan;
}

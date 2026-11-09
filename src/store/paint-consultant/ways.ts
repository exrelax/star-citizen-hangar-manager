import type { PaintRebuyPlan } from './calculation';

/*
 * The two ways of the Paint Discount Consultant's plan, side by side (the "ways" layout): "buy
 * first" pays the whole cart from the store credit before any paint is melted – safe, but limited
 * to the tier the store credit pays (`buyFirst`); "melt first" melts the own paints first, so
 * their melt value pays the cart too (`plan`). For each way its steps with the store credit after
 * each step, and the paints of its cart.
 */

export type WayKind = 'buy' | 'melt';

/** How the two ways compare: the same cart, a lower tier when buying first, or no cart at all. */
export type WaysComparison = 'same' | 'lowerTier' | 'impossible';

export type WayStepKind = 'cart' | 'pay' | 'melt' | 'fillers';

export interface WayStep {
  kind: WayStepKind;
  /** What the step changes the store credit by, in USD (0 for filling the cart). */
  amount: number;
  /** The store credit after the step. */
  balance: number;
  /** The step can't be done: the store credit doesn't pay the cart. */
  blocked?: boolean;
  /** Only after a blocked step. */
  faded?: boolean;
}

export interface PaintWay {
  kind: WayKind;
  /** The cart of this way; none when buying first isn't possible. */
  plan?: PaintRebuyPlan;
  /** Store credit needed before any paint is melted. */
  upfront: number;
  /** Store credit missing for it (buying first only). */
  missing: number;
  steps: WayStep[];
  /** What the filler paints melt for after 24 hours: what they cost in the cart. */
  fillerMelt: number;
  fillerCount: number;
}

export interface PaintWays {
  /** The store credit there is (0 if it isn't used). */
  credit: number;
  comparison: WaysComparison;
  buy: PaintWay;
  melt: PaintWay;
}

const cents = (usd: number) => Math.round(usd * 100);
const usd = (cents: number) => cents / 100;

/** What the own paints of a plan cost in its cart, in cents. */
const ownInCart = (plan: PaintRebuyPlan) =>
  Math.round(
    (plan.own.reduce((sum, paint) => sum + cents(paint.storePaint.price), 0) *
      (100 - plan.tier.percent)) /
      100,
  );

/** The filler paints melt for the rest of the cart (so the cents add up to the plan's result). */
const fillerMeltOf = (plan: PaintRebuyPlan) =>
  plan.fillers.length ? usd(cents(plan.cartCost) - ownInCart(plan)) : 0;

const fillerCountOf = (plan: PaintRebuyPlan) =>
  plan.fillers.reduce((sum, filler) => sum + filler.quantity, 0);

/** Applies the amounts one after the other, from the store credit there is. */
function withBalances(credit: number, steps: Omit<WayStep, 'balance'>[]): WayStep[] {
  let balance = cents(credit);
  return steps.map((step) => {
    balance += cents(step.amount);
    return { ...step, balance: usd(balance) };
  });
}

/** The steps of a cart, in the way's order. */
function stepsOf(kind: WayKind, plan: PaintRebuyPlan, credit: number, blocked = false) {
  const fillerMelt = fillerMeltOf(plan);
  const pay = { kind: 'pay' as const, amount: -plan.cartCost, ...(blocked && { blocked }) };
  const melt = { kind: 'melt' as const, amount: plan.meltValue, ...(blocked && { faded: true }) };
  const fillers = plan.fillers.length
    ? [{ kind: 'fillers' as const, amount: fillerMelt, ...(blocked && { faded: true }) }]
    : [];
  const cart = { kind: 'cart' as const, amount: 0 };
  const steps = withBalances(
    credit,
    kind === 'buy' ? [cart, pay, melt, ...fillers] : [cart, melt, pay, ...fillers],
  );
  // A blocked payment stops there: the steps after it show no store credit.
  return blocked ? steps.map((step, i) => (i > 1 ? { ...step, balance: NaN } : step)) : steps;
}

/**
 * Both ways of a plan: `plan` is the best cart with the melt value ("melt first"), `buyFirst` the
 * best one the store credit pays alone, if any.
 */
export function waysOf(
  plan: PaintRebuyPlan,
  buyFirst: PaintRebuyPlan | undefined,
  credit: number,
): PaintWays {
  const melt: PaintWay = {
    kind: 'melt',
    plan,
    upfront: plan.storeCreditNeeded,
    missing: 0,
    steps: stepsOf('melt', plan, credit),
    fillerMelt: fillerMeltOf(plan),
    fillerCount: fillerCountOf(plan),
  };
  const buy: PaintWay = buyFirst
    ? {
        kind: 'buy',
        plan: buyFirst,
        upfront: buyFirst.cartCost,
        missing: 0,
        steps: stepsOf('buy', buyFirst, credit),
        fillerMelt: fillerMeltOf(buyFirst),
        fillerCount: fillerCountOf(buyFirst),
      }
    : {
        // Not possible: as the melt-first cart, paid before the melt value is free.
        kind: 'buy',
        upfront: plan.cartCost,
        missing: usd(cents(plan.cartCost) - cents(credit)),
        steps: stepsOf('buy', plan, credit, true),
        fillerMelt: fillerMeltOf(plan),
        fillerCount: fillerCountOf(plan),
      };
  const comparison: WaysComparison = !buyFirst
    ? 'impossible'
    : buyFirst.tier.percent === plan.tier.percent
      ? 'same'
      : 'lowerTier';
  return { credit, comparison, buy, melt };
}

/** A paint of the cart, as a card: an own paint or one filler paint. */
export interface CartCard {
  key: string;
  skuId: number;
  name: string;
  filler: boolean;
  /** Its standard price and what it costs in the cart of each way it is in. */
  prices: Partial<Record<WayKind, { price: number; inCart: number }>>;
}

const inCartAt = (price: number, percent: number) => Math.round(price * (100 - percent)) / 100;

/** The units of a cart: the own paints, then each filler paint on its own. */
function unitsOf(plan: PaintRebuyPlan) {
  const units: { key: string; skuId: number; name: string; price: number; filler: boolean }[] =
    plan.own.map((paint) => ({
      key: `own-${paint.pledgeId}`,
      skuId: paint.storePaint.id,
      name: paint.storePaint.name,
      price: paint.storePaint.price,
      filler: false,
    }));
  for (const filler of plan.fillers) {
    for (let i = 0; i < filler.quantity; i++) {
      units.push({
        key: `filler-${filler.paint.id}-${i}`,
        skuId: filler.paint.id,
        name: filler.paint.name,
        price: filler.paint.price,
        filler: true,
      });
    }
  }
  return units;
}

/**
 * The paints of the carts as cards: one cart when both ways buy the same (or buying first isn't
 * possible), otherwise the paints of both, each with what it costs in either cart.
 */
export function cartCardsOf(ways: PaintWays): CartCard[] {
  const carts: [WayKind, PaintRebuyPlan][] =
    ways.comparison === 'lowerTier' && ways.buy.plan
      ? [
          ['buy', ways.buy.plan],
          ['melt', ways.melt.plan!],
        ]
      : [['melt', ways.melt.plan!]];
  const cards = new Map<string, CartCard>();
  for (const [kind, plan] of carts) {
    for (const unit of unitsOf(plan)) {
      const card = cards.get(unit.key) ?? {
        key: unit.key,
        skuId: unit.skuId,
        name: unit.name,
        filler: unit.filler,
        prices: {},
      };
      card.prices[kind] = { price: unit.price, inCart: inCartAt(unit.price, plan.tier.percent) };
      cards.set(unit.key, card);
    }
  }
  // Own paints first, then the fillers; within them as the larger cart has them.
  return [...cards.values()].sort((a, b) => Number(a.filler) - Number(b.filler));
}

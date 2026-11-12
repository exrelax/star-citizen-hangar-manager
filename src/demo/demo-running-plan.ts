import { DEMO, PAINT_CONSULTANT, PAINT_DISCOUNT_TIERS } from '@/config';
import type { PledgeView } from '@/hangar/pledge-view';
import { storeNameOf } from '@/store/items/item-prices';
import type { StoreItem } from '@/store/items/store-items';
import {
  dayOf,
  findRebought,
  ownPaintsOf,
  storePaintsOf,
  type PaintTier,
  type StorePaint,
} from '@/store/paint-consultant/calculation';
import type { CartLine } from '@/store/paint-consultant/cart';
import {
  COMPLETED_PLANS_VERSION,
  completedPlanOf,
  demoCompletedPlansItem,
  type CompletedPaintPlan,
} from '@/store/paint-consultant/completed-plans';
import {
  demoRebuyPlanItem,
  demoRunInputsItem,
  REBUY_PLAN_VERSION,
  type DemoRunInputs,
  type PlanWay,
  type StoredRebuyPlan,
} from '@/store/paint-consultant/rebuy-plan-storage';
import { planLinesOf } from '@/store/paint-consultant/running-plan';

/*
 * The running plan of the Paint Discount Consultant in the demo (#245, #303), one stage at a time,
 * so every state of its card shows: "melt first" with the cart incomplete (`cart`), the store
 * credit no longer enough (`credit`), ready to pay (`pay`), the filler paints waiting for RSI's 24
 * hours (`wait`) and ready to melt (`fillers`); "buy first" bought, its old paints left to melt
 * with the fillers waiting (`meltOld`); and no plan (`none`). With them the made-up cart and store
 * credit the card sees instead of RSI's, and two completed plans, one of each way. Built from the
 * demo's Pledge Store items and its hangar only: the melted paints are made up, the fillers and
 * the paint bought again are pledges of the demo hangar. Never in the account's storage.
 */

export type RunningPlanStage = 'cart' | 'credit' | 'pay' | 'meltOld' | 'wait' | 'fillers' | 'none';

export const RUNNING_PLAN_STAGES: readonly RunningPlanStage[] = [
  'cart',
  'credit',
  'pay',
  'meltOld',
  'wait',
  'fillers',
  'none',
];

/** A stage as stored for the demo: its plan, and the cart and store credit the card sees. */
export interface DemoRunningPlan {
  plan: StoredRebuyPlan | null;
  inputs: DemoRunInputs;
}

const HOUR = 60 * 60 * 1000;
const cents = (usd: number) => Math.round(usd * 100);
const usd = (cents: number) => cents / 100;
const keep = (price: number, tier: PaintTier) => Math.round((price * (100 - tier.percent)) / 100);

/** The best tier a cart of this many paints reaches; the lowest without one. */
const tierFor = (count: number): PaintTier => {
  const tiers = [...PAINT_DISCOUNT_TIERS.tiers].sort((a, b) => b.paints - a.paints);
  const tier = tiers.find((candidate) => candidate.paints <= count) ?? tiers.at(-1)!;
  return { paints: tier.paints, percent: tier.percent };
};

/** What the paints cost in the cart at the tier, in USD. */
const costOf = (prices: readonly number[], tier: PaintTier) =>
  usd(
    keep(
      prices.reduce((sum, price) => sum + cents(price), 0),
      tier,
    ),
  );

/** Filler paints of the demo hangar: single paints the store sells, not the pair bought again. */
function hangarFillers(
  pledges: readonly PledgeView[],
  storePaints: readonly StorePaint[],
  marked: readonly number[],
  skip: ReadonlySet<number>,
) {
  return ownPaintsOf(pledges, storePaints)
    .filter((paint) => !skip.has(paint.pledgeId))
    .sort(
      (a, b) =>
        Number(marked.includes(b.pledgeId)) - Number(marked.includes(a.pledgeId)) ||
        a.pledgeId - b.pledgeId,
    )
    .slice(0, PAINT_CONSULTANT.maxPerItem);
}

/** The fillers of the plan by SKU, with the pledges they are. */
function fillersOf(paints: ReturnType<typeof hangarFillers>) {
  const bySku = new Map<number, { paint: StorePaint; ids: number[] }>();
  for (const paint of paints) {
    const entry = bySku.get(paint.storePaint.id) ?? { paint: paint.storePaint, ids: [] };
    entry.ids.push(paint.pledgeId);
    bySku.set(paint.storePaint.id, entry);
  }
  return [...bySku.values()];
}

/**
 * The demo's running plan at a stage; undefined without the paints it needs (the catalog has none
 * the store sells on their own, or the hangar no single paint for the fillers).
 */
export function demoRunningPlan(
  stage: RunningPlanStage,
  input: {
    pledges: readonly PledgeView[];
    items: readonly StoreItem[];
    now: number;
    /** The demo's marked pledges: preferred as fillers, so the sidebar shows the same. */
    marked?: readonly number[];
    /** Pledges that are no fillers, e.g. a marked paint ready to melt while the fillers wait. */
    avoid?: readonly number[];
  },
): DemoRunningPlan | undefined {
  if (stage === 'none') return { plan: null, inputs: { cart: null } };
  const { pledges, now } = input;
  const storePaints = storePaintsOf(input.items);
  const pair = findRebought(ownPaintsOf(pledges, storePaints)).sort(
    (a, b) => b.copy.discount - a.copy.discount,
  )[0];
  const skip = new Set([
    ...(pair ? [pair.old.pledgeId, pair.copy.pledgeId] : []),
    ...(input.avoid ?? []),
  ]);
  const fillerPaints = hangarFillers(pledges, storePaints, input.marked ?? [], skip);
  if (!fillerPaints.length) return undefined;
  const fillers = fillersOf(fillerPaints);
  const fillerSkus = new Set(fillers.map((filler) => filler.paint.id));
  const fillerIds = fillerPaints.map((paint) => paint.pledgeId);
  const storedFillers = fillers.map((filler) => ({
    skuId: filler.paint.id,
    name: filler.paint.name,
    quantity: filler.ids.length,
    price: filler.paint.price,
  }));
  const fillerSkuOf = Object.fromEntries(
    fillers.flatMap((filler) => filler.ids.map((id) => [id, filler.paint.id] as const)),
  );

  if (stage === 'meltOld') {
    if (!pair) return undefined;
    const tier = tierFor(1 + fillerIds.length);
    const cartCost = costOf(
      [pair.old.storePaint.price, ...fillerPaints.map((paint) => paint.storePaint.price)],
      tier,
    );
    const at = now - 3 * HOUR;
    return {
      plan: {
        version: REBUY_PLAN_VERSION,
        way: 'buy',
        at,
        creditAtStart: usd(cents(cartCost) + 150),
        tier,
        own: [
          {
            pledgeId: pair.old.pledgeId,
            title: pair.old.title,
            skuId: pair.old.storePaint.id,
            meltValue: pair.old.meltValue,
            price: pair.old.storePaint.price,
          },
        ],
        fillers: storedFillers,
        cartCost,
        purchase: {
          orderId: 'DEMORUN',
          pledgeIds: fillerIds,
          ownPledgeIds: [pair.copy.pledgeId],
          skus: { ...fillerSkuOf, [pair.copy.pledgeId]: pair.copy.storePaint.id },
          // Without the pledge log's time the cooldown counts from here: 21 hours left.
          foundAt: now - 3 * HOUR,
        },
      },
      inputs: { cart: [], credit: 1.5 },
    };
  }

  // Melting first: two made-up paints melted, the priciest the store sells.
  // None bought since the plan's day: such a copy would read as bought again.
  const since = dayOf(now - 27 * HOUR);
  const inHangar = new Set(
    pledges
      .filter((pledge) => (pledge.createdAt ?? '') >= since)
      .map((pledge) => storeNameOf(pledge.title)),
  );
  const melted = storePaints
    .filter((paint) => !fillerSkus.has(paint.id) && !inHangar.has(storeNameOf(paint.name)))
    .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
    .slice(0, 2);
  if (!melted.length) return undefined;
  const tier = tierFor(melted.length + fillerIds.length);
  const cartCost = costOf(
    [...melted, ...fillerPaints.map((paint) => paint.storePaint)].map((paint) => paint.price),
    tier,
  );
  const at = now - (stage === 'fillers' ? 27 : 4) * HOUR;
  const plan: StoredRebuyPlan = {
    version: REBUY_PLAN_VERSION,
    way: 'melt',
    at,
    creditAtStart: usd(Math.max(0, cents(cartCost) - 500)),
    tier,
    own: melted.map((paint, index) => {
      const meltValue = usd(cents(paint.price * 0.8));
      return {
        pledgeId: DEMO.idBase - 310_000 - index,
        title: `Paints - ${paint.name}`,
        skuId: paint.id,
        meltValue,
        price: paint.price,
        meltedAt: at + 10 * 60 * 1000,
        freed: meltValue,
      };
    }),
    fillers: storedFillers,
    cartCost,
  };
  const lines = planLinesOf(plan, input.items).map(({ skuId, qty }) => ({ skuId, qty }));
  const enough = usd(cents(cartCost) + 2920);

  switch (stage) {
    case 'cart': {
      // The second melted paint and the last filler not in the cart yet.
      const missing = new Set([plan.own.at(-1)!.skuId, storedFillers.at(-1)!.skuId]);
      const cart: CartLine[] = lines.flatMap((line) =>
        missing.has(line.skuId) ? (line.qty > 1 ? [{ ...line, qty: line.qty - 1 }] : []) : [line],
      );
      return { plan, inputs: { cart, credit: enough } };
    }
    case 'credit':
      return { plan, inputs: { cart: lines, credit: usd(Math.max(0, cents(cartCost) - 660)) } };
    case 'pay':
      return { plan, inputs: { cart: lines, credit: enough } };
    default: {
      // Paid: 2 hours 18 minutes ago (`wait`), or 25 hours ago (`fillers`).
      const paidAt = now - (stage === 'wait' ? 2 * HOUR + 18 * 60 * 1000 : 25 * HOUR);
      return {
        plan: {
          ...plan,
          purchase: {
            orderId: 'DEMORUN',
            pledgeIds: fillerIds,
            ownPledgeIds: [],
            skus: fillerSkuOf,
            foundAt: paidAt,
          },
        },
        inputs: { cart: [], credit: usd(cents(plan.creditAtStart!) + 290) },
      };
    }
  }
}

/** A made-up finished plan of the store's paints, completed `daysAgo` days before `now`. */
function completedDemoPlan(
  way: PlanWay,
  own: readonly StorePaint[],
  fillers: readonly { paint: StorePaint; quantity: number }[],
  items: readonly StoreItem[],
  creditBefore: number,
  now: number,
  daysAgo: number,
): CompletedPaintPlan {
  const count = own.length + fillers.reduce((sum, filler) => sum + filler.quantity, 0);
  const tier = tierFor(count);
  const at = now - daysAgo * 24 * HOUR;
  const plan: StoredRebuyPlan = {
    version: REBUY_PLAN_VERSION,
    way,
    at,
    creditAtStart: creditBefore,
    tier,
    own: own.map((paint, index) => ({
      pledgeId: DEMO.idBase - 320_000 - daysAgo * 10 - index,
      title: `Paints - ${paint.name}`,
      skuId: paint.id,
      meltValue: usd(cents(paint.price * 0.8)),
      price: paint.price,
    })),
    fillers: fillers.map((filler) => ({
      skuId: filler.paint.id,
      name: filler.paint.name,
      quantity: filler.quantity,
      price: filler.paint.price,
    })),
    cartCost: costOf(
      [
        ...own.map((paint) => paint.price),
        ...fillers.flatMap((filler) => Array<number>(filler.quantity).fill(filler.paint.price)),
      ],
      tier,
    ),
  };
  const done = completedPlanOf(plan, { pledges: [], storeItems: items, credit: undefined, now });
  return {
    ...done,
    completedAt: at + 26 * HOUR,
    creditAfter: usd(cents(creditBefore) + cents(done.result)),
  };
}

/**
 * The demo's completed plans, newest first: "melt first" with two paints at the best tier, and
 * "buy first" with three at a lower one, two weeks earlier.
 */
export function demoCompletedPlans(items: readonly StoreItem[], now: number): CompletedPaintPlan[] {
  const paints = storePaintsOf(items).sort((a, b) => b.price - a.price || a.id - b.id);
  const cheap = [...paints].reverse();
  if (paints.length < 5) return [];
  const melt = completedDemoPlan(
    'melt',
    paints.slice(0, 2),
    [
      { paint: cheap[0]!, quantity: PAINT_CONSULTANT.maxPerItem },
      { paint: cheap[1]!, quantity: 3 },
    ],
    items,
    42,
    now,
    1,
  );
  const buy = completedDemoPlan(
    'buy',
    paints.slice(2, 5),
    [{ paint: cheap[0]!, quantity: 2 }],
    items,
    30,
    now,
    15,
  );
  return [melt, buy];
}

/** The demo key and stage the running plan was set for. */
const seededItem = storage.defineItem<string | null>('local:demo.consultantRunSeeded', {
  fallback: null,
});

/**
 * Sets the demo's running plan, its cart and store credit, and its completed plans – once per
 * demo key and stage, so changing the stage sets them again.
 */
export async function seedDemoRunningPlan(
  key: string,
  stage: RunningPlanStage,
  running: DemoRunningPlan | undefined,
  completed: readonly CompletedPaintPlan[],
): Promise<void> {
  const seed = `${key}:${stage}`;
  if ((await seededItem.getValue()) === seed) return;
  await Promise.all([
    demoRebuyPlanItem.setValue(running?.plan ?? null),
    demoRunInputsItem.setValue(running?.inputs ?? null),
    demoCompletedPlansItem.setValue({ version: COMPLETED_PLANS_VERSION, plans: [...completed] }),
  ]);
  await seededItem.setValue(seed);
}

/** The running plan set again with the next look at the demo hangar. */
export async function resetDemoRunningPlan(): Promise<void> {
  await seededItem.removeValue();
}

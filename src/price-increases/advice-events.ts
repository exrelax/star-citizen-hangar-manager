import type { BaseHoldings, CcuAdviceGroup, CcuAlternative, CcuBaseChoice } from './ccu-advice';
import type { ExpectedPriceIncrease } from './price-increases';
import type { Ship } from '@/ships/ships';

/*
 * The advice of the "Keep the discount" dialog per rising ship (#274): the groups of `ccuAdvice`
 * (one per base and target ship) of the same price increase together. The recommendation is the
 * same for all of them – the base ship of the new CCUs depends on the rising ship only –, so it is
 * shown once, with the sums of its groups: what their discount is today, if kept and if swapped,
 * and what melting gives back against what the new CCUs cost. Groups without a recommendation
 * (the new price unknown, not sold, keeping is better) are listed apart.
 */

/** The recommendation for the CCUs of a rising ship, with the sums of its groups. */
export interface AdvicePlan {
  /** The base ship of the new CCUs, how it was chosen, and what the user has of it. */
  from: Ship;
  choice: CcuBaseChoice;
  holdings: BaseHoldings;
  alternatives: CcuAlternative[];
  /** The rising ship: the target of the new CCUs. */
  to: Ship;
  /** Price of one new CCU, and its discount after the increase. */
  price: number;
  discountAfter: number;
  /** The CCUs to swap, how many can be gifted now, what the new ones cost together. */
  ccus: number;
  giftable: number;
  total: number;
  /** The discount of all new CCUs after the increase. */
  swapped: number;
  /** What melting gives back minus what the new CCUs cost: positive, store credit is left. */
  credit: number;
  storeCreditNeeded: number;
  enoughStoreCredit?: boolean;
}

/** The discount of the recommended CCUs, where every group's amounts are known. */
export interface AdviceOutcome {
  ccus: number;
  today: number;
  kept: number;
  swapped: number;
  credit: number;
}

/** A group with a recommendation, as a row of the dialog's table. */
export interface AdviceRow {
  key: string;
  group: CcuAdviceGroup;
  /** The group of the CCU the dialog was opened from. */
  origin: boolean;
  today?: number;
  kept?: number;
  swapped: number;
  credit: number;
}

export interface AdviceEvent {
  key: string;
  increase: ExpectedPriceIncrease;
  plan?: AdvicePlan;
  outcome?: AdviceOutcome;
  /** The groups with a recommendation, the most discount at stake first. */
  rows: AdviceRow[];
  /** The groups without one. */
  others: CcuAdviceGroup[];
}

const cents = (value: number) => Math.round(value * 100) / 100;
const sum = (values: readonly number[]) => cents(values.reduce((total, value) => total + value, 0));

/**
 * The groups per price increase: the one of the CCU it was opened from (`pledgeId`) first, then
 * those with a recommendation, each by the time of the increase.
 */
export function adviceEvents(
  groups: readonly CcuAdviceGroup[],
  storeCredit?: number,
  pledgeId?: number,
): AdviceEvent[] {
  const byIncrease = new Map<string, CcuAdviceGroup[]>();
  for (const group of groups) {
    const key = `${group.increase.ship.id}@${group.increase.priceIncreaseAt.at}`;
    byIncrease.set(key, [...(byIncrease.get(key) ?? []), group]);
  }
  const isOrigin = (group: CcuAdviceGroup) => group.ccus.some((ccu) => ccu.id === pledgeId);

  const events = [...byIncrease].map(([key, list]): AdviceEvent => {
    const increase = list[0]!.increase;
    const rows = list
      .filter((group) => group.switch)
      .map((group): AdviceRow => {
        const plan = group.switch!;
        const count = group.ccus.length;
        return {
          key: `${key}>${group.target.id}`,
          group,
          origin: isOrigin(group),
          ...(group.keep && { today: group.keep.discountNow, kept: group.keep.discountAfter }),
          swapped: cents(plan.discountAfter * count),
          credit: cents(group.meltValue - plan.price * count),
        };
      })
      .sort((a, b) => b.swapped - (b.kept ?? 0) - (a.swapped - (a.kept ?? 0)));
    const others = list.filter((group) => !group.switch);
    const first = rows[0]?.group.switch;
    if (!first) return { key, increase, rows, others };

    const ccus = sum(rows.map((row) => row.group.ccus.length));
    const total = cents(first.price * ccus);
    const melt = sum(rows.map((row) => row.group.meltValue));
    const storeCreditNeeded = Math.max(0, cents(total - melt));
    const plan: AdvicePlan = {
      from: first.from,
      choice: first.choice,
      holdings: first.holdings,
      alternatives: first.alternatives,
      to: first.to,
      price: first.price,
      discountAfter: first.discountAfter,
      ccus,
      giftable: sum(rows.map((row) => row.group.giftable)),
      total,
      swapped: sum(rows.map((row) => row.swapped)),
      credit: cents(melt - total),
      storeCreditNeeded,
      ...(storeCredit !== undefined && { enoughStoreCredit: storeCredit >= storeCreditNeeded }),
    };
    const known = rows.every((row) => row.today !== undefined && row.kept !== undefined);
    const outcome: AdviceOutcome | undefined = known
      ? {
          ccus,
          today: sum(rows.map((row) => row.today!)),
          kept: sum(rows.map((row) => row.kept!)),
          swapped: plan.swapped,
          credit: plan.credit,
        }
      : undefined;
    return { key, increase, plan, ...(outcome && { outcome }), rows, others };
  });

  const rank = (event: AdviceEvent) =>
    [...event.rows.map((row) => row.group), ...event.others].some(isOrigin)
      ? 0
      : event.plan
        ? 1
        : 2;
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => rank(a.event) - rank(b.event) || a.index - b.index)
    .map(({ event }) => event);
}

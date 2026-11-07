import { PLEDGE_FILTER_CATEGORIES, PLEDGE_FILTER_PREDICATES, type PledgeFilter } from './filters';
import type { PledgeView } from './pledge-view';

/*
 * The totals of the summary box (see `HangarSummary.vue`): of the visible pledges, and of the
 * selected ones.
 */

export interface PledgeSummary {
  count: number;
  /** Summed value (melt value) in USD. */
  value: number;
  /** Summed discounts in USD: only real ones – pledges that cost more don't reduce it. */
  discount: number;
  /** Pledges per type (ships, CCUs, …); a pledge can count for more than one. */
  types: { type: PledgeFilter; count: number }[];
}

export function summarize(pledges: readonly PledgeView[]): PledgeSummary {
  let value = 0;
  let discount = 0;
  for (const pledge of pledges) {
    value += pledge.valueUsd;
    if (pledge.discount && pledge.discount.amount > 0) discount += pledge.discount.amount;
  }
  const types = PLEDGE_FILTER_CATEGORIES.types
    .map((type) => ({
      type,
      count: pledges.filter((pledge) => PLEDGE_FILTER_PREDICATES[type](pledge)).length,
    }))
    .filter(({ count }) => count > 0);
  return { count: pledges.length, value: round(value), discount: round(discount), types };
}

const round = (amount: number) => Math.round(amount * 100) / 100;

import type { CcuAdviceGroup } from '@/price-increases/ccu-advice';
import { isWithinDays } from '@/price-increases/price-increases';

/*
 * The CCU Consultant's tab "Discount at risk" (#455): the CCUs of the hangar whose base ship rises
 * in price within the period of the settings, by pair of base and target ship, with the advice of
 * the Price Increase Advisor (#252, `ccu-advice.ts`). Price increases confirmed by CIG stand apart
 * from those only expected (#275). The pairs that lose the most discount come first; those whose
 * new price isn't known yet (the loss unknown) last.
 */

export interface AtRiskRow {
  group: CcuAdviceGroup;
  /** The discount they lose with the increase, with the new price known. */
  loss?: number;
}

export interface DiscountAtRisk {
  confirmed: AtRiskRow[];
  expected: AtRiskRow[];
  /** How many CCUs lose their discount. */
  count: number;
}

const cents = (value: number) => Math.round(value * 100) / 100;

export function discountAtRisk(
  groups: readonly CcuAdviceGroup[],
  now: number,
  days: number,
): DiscountAtRisk {
  const rows = groups
    .filter((group) => isWithinDays(group.increase, now, days))
    .map((group): AtRiskRow => ({
      group,
      ...(group.keep && { loss: cents(group.keep.discountNow - group.keep.discountAfter) }),
    }))
    .sort(
      (a, b) =>
        (b.loss ?? -Infinity) - (a.loss ?? -Infinity) ||
        a.group.increase.priceIncreaseAt.at - b.group.increase.priceIncreaseAt.at ||
        a.group.target.name.localeCompare(b.group.target.name),
    );
  return {
    confirmed: rows.filter((row) => row.group.increase.confirmed),
    expected: rows.filter((row) => !row.group.increase.confirmed),
    count: rows.reduce((sum, row) => sum + row.group.ccus.length, 0),
  };
}

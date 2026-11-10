import type { PledgeView } from '@/hangar/pledge-view';
import { planPaintRebuy, type PaintConsultantResult } from '@/store/paint-consultant/calculation';
import type { StoreItem } from '@/store/items/store-items';

/*
 * The store credit of the demo (#179), set in the demo settings instead of a random one: the
 * Paint Discount Consultant works differently with it (`ways.ts`). Its quick choices give the
 * store credit for each case on the current demo hangar – both ways reach the same tier, buying
 * first only a lower tier, buying first isn't possible, and no store credit –, worked out from
 * the demo's paints and the Pledge Store's prices, so they keep working when the hangar changes.
 */

export const CREDIT_CASES = ['same', 'lowerTier', 'impossible', 'none'] as const;
export type CreditCase = (typeof CREDIT_CASES)[number];

/** The case of a result: how buying first compares with melting first. */
export function caseOf(result: PaintConsultantResult): CreditCase | undefined {
  if (!result.plan) return undefined;
  if (!result.buyFirst) return 'impossible';
  return result.buyFirst.tier.percent === result.plan.tier.percent ? 'same' : 'lowerTier';
}

/** The store credit for each case the demo hangar allows; cases it can't show are left out. */
export function creditForCases(
  pledges: readonly PledgeView[],
  storeItems: readonly StoreItem[],
  options: { useFillers: boolean; skipGiftable: boolean },
): Partial<Record<CreditCase, number>> {
  const plan = (storeCredit: number) =>
    planPaintRebuy({ pledges, storeItems, storeCredit, ...options, guessRebought: false });
  const found: Partial<Record<CreditCase, number>> = { none: 0 };
  // The amounts where a case can change: what each tier's cart costs and needs, and a cent less.
  const candidates = new Set<number>([0]);
  let credit = 100_000;
  for (let step = 0; step < 12; step++) {
    const result = plan(credit);
    const cart = result.plan;
    if (!cart) break;
    for (const value of [cart.cartCost, cart.storeCreditNeeded, result.buyFirst?.cartCost ?? 0]) {
      candidates.add(value);
      candidates.add(Math.max(0, Math.round((value - 0.01) * 100) / 100));
    }
    if (cart.storeCreditNeeded <= 0) break;
    credit = Math.round((cart.storeCreditNeeded - 0.01) * 100) / 100;
  }
  // And the amounts between them, where buying first may reach only a lower tier.
  const sorted = [...candidates].sort((a, b) => a - b);
  sorted
    .slice(1)
    .forEach((value, index) =>
      candidates.add(Math.round(((value + sorted[index]!) / 2) * 100) / 100),
    );
  for (const candidate of [...candidates].sort((a, b) => b - a)) {
    const result = plan(candidate);
    const kind = caseOf(result);
    if (kind && kind !== 'none' && found[kind] === undefined) found[kind] = candidate;
  }
  return found;
}

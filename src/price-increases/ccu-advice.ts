import type { PledgeView } from '@/hangar/pledge-view';
import type { Ship, ShipSku, WarbondSku } from '@/ships/ships';
import { createShipLookup } from '@/store/warbond';
import type { ExpectedPriceIncrease } from './price-increases';

/*
 * Advice for the CCUs of My Hangar that lose upgrade value with a price increase (#252, part of
 * the Price Increase Advisor #248). Example: the Prospector rises from $155 to $175, so 8 CCUs
 * Prospector → Vulture ($175) bought for $5 each lose their $20 upgrade value. Melted, they give
 * back $5 of store credit each, enough for 8 CCUs Freelancer MAX ($170) → Vulture for $5: the
 * discount grows from −$5 to $0 each.
 *
 * Per target ship the advice compares keeping the CCUs with buying the same number of CCUs to the
 * same target from another base ship, which the upgrade tool sells today:
 * - **Standard**: paid with store credit, so the melt value pays for it. It costs the difference of
 *   the standard prices and gives no discount. Of the base ships, the one whose CCU costs the most
 *   without costing more than a melted CCU gives back – or, if every CCU costs more, the cheapest.
 * - **Warbond**: only with money (RSI sells warbond CCUs for new money only), but with the
 *   warbond's discount; the base ship is chosen the same way.
 * Base ships whose own price is about to rise are left out. A suggestion only: the extension
 * never melts or buys by itself.
 */

export type CcuAdviceKind = 'standard' | 'warbond';

export interface CcuAdviceOption {
  kind: CcuAdviceKind;
  base: Ship;
  /** Price of one CCU in USD. */
  price: number;
  /** Upgrade value of one CCU: target's standard price minus base's. */
  upgradeValue: number;
  /** Discount of one CCU: `upgradeValue - price`. */
  discount: number;
  /** Price of all of them. */
  total: number;
  /** Standard only: store credit needed besides what melting the old CCUs gives back. */
  storeCreditNeeded?: number;
  /** Standard only, with a known store credit: whether it is enough. */
  enoughStoreCredit?: boolean;
  /** How much the total discount grows compared with keeping the CCUs, if their change is known. */
  gain?: number;
}

/** The CCUs as they are, before and after the increase; only with known amounts. */
export interface CcuAdviceKeep {
  upgradeValueNow: number;
  upgradeValueAfter: number;
  discountNow: number;
  discountAfter: number;
}

export interface CcuAdviceGroup {
  /** The ship whose price rises (the CCUs' base). */
  increase: ExpectedPriceIncrease;
  target: Ship;
  /** The CCUs losing value, newest first. */
  ccus: PledgeView[];
  /** What melting all of them gives back in store credit. */
  meltValue: number;
  /** How many of them can be gifted now – bought again with store credit, they can't. */
  giftable: number;
  keep?: CcuAdviceKeep;
  /** Standard first, then warbond; none if the upgrade tool sells no CCU to the target. */
  options: CcuAdviceOption[];
}

export interface CcuAdviceInput {
  /** The pledges of My Hangar; only CCUs losing value count. */
  pledges: readonly PledgeView[];
  /** The upgrade tool: every ship, the SKUs on sale and the warbond editions. */
  ships: readonly Ship[];
  buyable: readonly ShipSku[];
  warbonds: readonly WarbondSku[];
  /** Ships (by id) whose price is about to rise: no base ship for the advice. */
  risingShipIds?: ReadonlySet<number>;
  /** The account's store credit in USD, if known. */
  storeCredit?: number;
}

const cents = (value: number) => Math.round(value * 100) / 100;
const sum = (values: readonly number[]) => cents(values.reduce((total, value) => total + value, 0));

/**
 * The base ship for CCUs to a ship of `price`: the CCU costing the most without costing more than
 * `budget`, else the cheapest one.
 */
function bestBase(
  ships: readonly Ship[],
  target: Ship,
  price: number,
  budget: number,
  rising: ReadonlySet<number>,
): Ship | undefined {
  const candidates = ships
    .filter(
      (ship) => ship.id !== target.id && !rising.has(ship.id) && ship.msrp > 0 && ship.msrp < price,
    )
    // The most expensive base first: its CCU is the cheapest.
    .sort((a, b) => b.msrp - a.msrp || a.name.localeCompare(b.name));
  // Within the budget: the cheapest base (the most expensive CCU), by name on a tie.
  const withinBudget = candidates.filter((ship) => price - ship.msrp <= budget + 0.005);
  const lowest = withinBudget.at(-1);
  return withinBudget.find((ship) => ship.msrp === lowest?.msrp) ?? candidates[0];
}

function option(
  kind: CcuAdviceKind,
  base: Ship,
  target: Ship,
  price: number,
  group: { count: number; meltValue: number; discountAfter?: number },
  storeCredit: number | undefined,
): CcuAdviceOption {
  const ccuPrice = cents(price - base.msrp);
  const upgradeValue = cents(target.msrp - base.msrp);
  const discount = cents(upgradeValue - ccuPrice);
  const total = cents(ccuPrice * group.count);
  const result: CcuAdviceOption = { kind, base, price: ccuPrice, upgradeValue, discount, total };
  if (kind === 'standard') {
    result.storeCreditNeeded = Math.max(0, cents(total - group.meltValue));
    if (storeCredit !== undefined)
      result.enoughStoreCredit = storeCredit >= result.storeCreditNeeded;
  }
  if (group.discountAfter !== undefined) {
    result.gain = cents(discount * group.count - group.discountAfter);
  }
  return result;
}

/** The advice for every target ship of CCUs losing value, the next price increase first. */
export function ccuAdvice(input: CcuAdviceInput): CcuAdviceGroup[] {
  const { ships, buyable, warbonds, risingShipIds = new Set(), storeCredit } = input;
  const lookup = createShipLookup(ships);
  const warbondSkus = new Set(warbonds.map((warbond) => warbond.skuId));
  const groups = new Map<
    string,
    { increase: ExpectedPriceIncrease; target: Ship; ccus: PledgeView[] }
  >();

  for (const pledge of input.pledges) {
    const change = pledge.ccuPriceChange;
    if (!pledge.isCcu || change?.direction !== 'loses' || !change.base) continue;
    const targetName = pledge.upgrade?.targetItems[0]?.name;
    const target = targetName ? lookup.shipOf(targetName) : undefined;
    if (!target) continue;
    const key = `${change.base.ship.id}>${target.id}`;
    const group = groups.get(key) ?? { increase: change.base, target, ccus: [] };
    group.ccus.push(pledge);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(({ increase, target, ccus }): CcuAdviceGroup => {
      const count = ccus.length;
      const meltValue = sum(ccus.map((ccu) => ccu.valueUsd));
      const amounts = ccus.map((ccu) => ccu.ccuPriceChange?.amounts);
      const known = amounts.every((amount) => amount !== undefined);
      const keep: CcuAdviceKeep | undefined = known
        ? {
            upgradeValueNow: sum(amounts.map((amount) => amount!.before)),
            upgradeValueAfter: sum(amounts.map((amount) => amount!.after)),
            discountNow: cents(sum(amounts.map((amount) => amount!.before)) - meltValue),
            discountAfter: cents(sum(amounts.map((amount) => amount!.after)) - meltValue),
          }
        : undefined;
      const perCcu = meltValue / count;
      // The rising ship itself is never a base.
      const rising = new Set([...risingShipIds, increase.ship.id]);
      const stats = { count, meltValue, discountAfter: keep?.discountAfter };

      const options: CcuAdviceOption[] = [];
      // RSI sells standard CCUs to ships on sale in another edition than the warbond.
      const onSale = buyable.some((sku) => sku.shipId === target.id && !warbondSkus.has(sku.skuId));
      const standardBase = onSale && bestBase(ships, target, target.msrp, perCcu, rising);
      if (standardBase) {
        options.push(option('standard', standardBase, target, target.msrp, stats, storeCredit));
      }
      const warbond = warbonds.find((offer) => offer.shipId === target.id);
      const warbondBase = warbond && bestBase(ships, target, warbond.price, perCcu, rising);
      if (warbond && warbondBase) {
        options.push(option('warbond', warbondBase, target, warbond.price, stats, storeCredit));
      }

      return {
        increase,
        target,
        ccus,
        meltValue,
        giftable: ccus.filter((ccu) => ccu.isGiftable).length,
        ...(keep && { keep }),
        options,
      };
    })
    .sort(
      (a, b) =>
        a.increase.priceIncreaseAt.at - b.increase.priceIncreaseAt.at ||
        a.target.name.localeCompare(b.target.name),
    );
}

import { PAINT_CONSULTANT, PAINT_DISCOUNT_TIERS } from '@/config';
import type { PledgeItem } from '@/hangar/pledge';
import { isPaintItem } from '@/hangar/pledge-view';
import { roundToPaintTier } from '@/hangar/ship-prices';
import { storeNameOf } from '../items/item-prices';
import type { StoreItem } from '../items/store-items';

/*
 * The calculation of the Paint Discount Consultant (#95): which own paints can be bought again
 * with a higher volume discount, and which cheap filler paints reach that discount tier.
 *
 * The idea: melt own paints that were bought with less discount than reachable now, buy them
 * again together with filler paints at the tier's discount, and melt the fillers again after 24
 * hours (RSI's cooldown after every purchase). Only store credit is used, never new money: the
 * cart is paid with the melt value of the own paints plus, if allowed, the current store credit.
 * Fillers cost nothing in the end, as they melt for what was paid for them; the own paints free
 * the difference between their melt value and their new, discounted price as store credit. The
 * melt value of the account drops by the same amount: melt value becomes free store credit.
 *
 * Only single paints: pledges with exactly one paint, and single paints of the Pledge Store.
 * Paint packs are left out (#134). All amounts in USD without taxes (there are none on store
 * credit); computed in cents.
 */

/** What the consultant needs of an own pledge; a `PledgeView` fits. */
export interface PaintPledge {
  id: number;
  title: string;
  /** What melting it gives, in USD. */
  valueUsd: number;
  items: readonly PledgeItem[];
  /** Set for CCUs. */
  upgrade?: unknown;
  /** Can be melted (exchanged): not protected by RSI's game access either. */
  isMeltable: boolean;
}

/** A paint of the Pledge Store that can be bought on its own with store credit. */
export interface StorePaint {
  /** RSI's SKU id, for the cart. */
  id: number;
  name: string;
  /** Standard price in USD; the volume discount is taken off in the cart. */
  price: number;
}

/** An own pledge with exactly one paint that can be melted and bought again. */
export interface OwnPaint {
  pledgeId: number;
  /** The pledge's title, e.g. "Paints - Paladin - Shadowfall Paint". */
  title: string;
  /** What melting the pledge gives, in USD. */
  meltValue: number;
  /** The same paint in the Pledge Store. */
  storePaint: StorePaint;
  /** Its discount compared to the current price, rounded to the tiers, in percent. */
  discount: number;
}

/** A volume discount tier: from this many paints in the cart, this discount. */
export interface PaintTier {
  paints: number;
  percent: number;
}

/** Filler paints of one SKU in the cart. */
export interface FillerPaint {
  paint: StorePaint;
  quantity: number;
}

/** What to buy again at a tier, and what it gives. */
export interface PaintRebuyPlan {
  tier: PaintTier;
  /** Own paints to melt and buy again. */
  own: OwnPaint[];
  /** Filler paints to buy and melt again after 24 hours. */
  fillers: FillerPaint[];
  /** Sum of the standard prices in the cart. */
  cartPrice: number;
  /** What the cart costs after the volume discount. */
  cartCost: number;
  /** Melt value of the own paints. */
  meltValue: number;
  /** Store credit needed besides the melt value of the own paints. */
  storeCreditNeeded: number;
  /** Store credit freed once the fillers are melted again. */
  storeCreditFreed: number;
}

/** The store credit a tier would need beyond what there is. */
export interface MissingCredit {
  tier: PaintTier;
  missing: number;
}

export interface PaintConsultantResult {
  /** The best tier that can be paid, if any. */
  plan?: PaintRebuyPlan;
  /**
   * The next tier above the plan (without a plan: the one closest to being paid) and the store
   * credit missing for it.
   */
  next?: MissingCredit;
}

export interface PaintConsultantInput {
  pledges: readonly PaintPledge[];
  storeItems: readonly StoreItem[];
  /** Store credit that may be used (0 if the setting leaves it out). */
  storeCredit: number;
  /** Whether filler paints may be bought to reach a tier. */
  useFillers: boolean;
}

const cents = (usd: number) => Math.round(usd * 100);
const usd = (cents: number) => cents / 100;

/** Paint packs and collections: several paints in one item (#134). */
const PACK = /\b(pack|collection)\b/i;

/**
 * The paints of the Pledge Store that can be bought on their own with store credit: available,
 * no warbond (they need new money), no packs. Items with a sale price are left out too: so far
 * only packs have one, and the consultant can't tell how it combines with the volume discount.
 */
export function storePaintsOf(items: readonly StoreItem[]): StorePaint[] {
  return items
    .filter(
      (item) =>
        item.category === 'Paints' &&
        item.available &&
        !item.isWarbond &&
        item.discountedPrice === undefined &&
        !PACK.test(item.name) &&
        item.price > 0,
    )
    .map(({ id, name, price }) => ({ id, name, price }));
}

/**
 * The own pledges with exactly one paint that can be melted and that the Pledge Store sells
 * on their own, with their discount compared to the current price.
 */
export function ownPaintsOf(
  pledges: readonly PaintPledge[],
  storePaints: readonly StorePaint[],
): OwnPaint[] {
  const byName = new Map(storePaints.map((paint) => [storeNameOf(paint.name), paint]));
  return pledges.flatMap((pledge) => {
    const [item, ...others] = pledge.items;
    if (!item || others.length || pledge.upgrade || !isPaintItem(item) || !pledge.isMeltable) {
      return [];
    }
    if (!(pledge.valueUsd > 0)) return [];
    const storePaint = byName.get(storeNameOf(pledge.title)) ?? byName.get(storeNameOf(item.title));
    if (!storePaint) return [];
    const discount = roundToPaintTier((1 - pledge.valueUsd / storePaint.price) * 100);
    return [
      {
        pledgeId: pledge.id,
        title: pledge.title,
        meltValue: pledge.valueUsd,
        storePaint,
        discount,
      },
    ];
  });
}

/** What a cart at `tier` would contain and cost, if it can be filled at all. */
function cartAt(
  tier: PaintTier,
  ownPaints: readonly OwnPaint[],
  storePaints: readonly StorePaint[],
  useFillers: boolean,
): PaintRebuyPlan | undefined {
  const { maxPerItem } = PAINT_CONSULTANT;
  // Own paints that gain at this tier; at most `maxPerItem` of one SKU, those that gain most.
  const perSku = new Map<number, number>();
  const own = ownPaints
    .filter((paint) => paint.discount < tier.percent)
    .sort((a, b) => b.meltValue - a.meltValue)
    .filter((paint) => {
      const count = perSku.get(paint.storePaint.id) ?? 0;
      if (count >= maxPerItem) return false;
      perSku.set(paint.storePaint.id, count + 1);
      return true;
    });
  if (!own.length) return undefined;

  // The cheapest paints fill the cart up to the tier, each up to `maxPerItem` times.
  let needed = Math.max(0, tier.paints - own.length);
  if (needed && !useFillers) return undefined;
  const fillers: FillerPaint[] = [];
  const cheapest = [...storePaints].sort(
    (a, b) => a.price - b.price || a.name.localeCompare(b.name),
  );
  for (const paint of cheapest) {
    if (!needed) break;
    const quantity = Math.min(needed, maxPerItem - (perSku.get(paint.id) ?? 0));
    if (quantity <= 0) continue;
    fillers.push({ paint, quantity });
    needed -= quantity;
  }
  if (needed) return undefined;

  const ownPrice = own.reduce((sum, paint) => sum + cents(paint.storePaint.price), 0);
  const fillerPrice = fillers.reduce((sum, f) => sum + cents(f.paint.price) * f.quantity, 0);
  const keep = (price: number) => Math.round((price * (100 - tier.percent)) / 100);
  const cartCost = keep(ownPrice + fillerPrice);
  const meltValue = own.reduce((sum, paint) => sum + cents(paint.meltValue), 0);
  return {
    tier,
    own,
    fillers,
    cartPrice: usd(ownPrice + fillerPrice),
    cartCost: usd(cartCost),
    meltValue: usd(meltValue),
    storeCreditNeeded: usd(Math.max(0, cartCost - meltValue)),
    // The fillers melt for what they cost; the own paints keep their new, discounted price.
    storeCreditFreed: usd(meltValue - keep(ownPrice)),
  };
}

/**
 * The best plan: the tiers are tried from the top, and the first one whose cart the store credit
 * pays is the best one – fillers cost nothing in the end, and every own paint frees more store
 * credit at a higher tier.
 */
export function planPaintRebuy(input: PaintConsultantInput): PaintConsultantResult {
  const storePaints = storePaintsOf(input.storeItems);
  const ownPaints = ownPaintsOf(input.pledges, storePaints);
  const credit = cents(Math.max(0, input.storeCredit));
  const tiers = [...PAINT_DISCOUNT_TIERS.tiers].sort((a, b) => b.percent - a.percent);

  const carts = tiers.flatMap((tier) => {
    const cart = cartAt(tier, ownPaints, storePaints, input.useFillers);
    return cart ? [cart] : [];
  });
  const missingOf = (cart: PaintRebuyPlan) => cents(cart.storeCreditNeeded) - credit;
  const plan = carts.find((cart) => missingOf(cart) <= 0);

  // The tier just above the plan; without a plan, the one that needs the least.
  const above = plan ? carts.filter((cart) => cart.tier.percent > plan.tier.percent) : carts;
  const next = plan ? above.at(-1) : [...above].sort((a, b) => missingOf(a) - missingOf(b))[0];
  return {
    plan,
    next: next && { tier: next.tier, missing: usd(Math.max(0, missingOf(next))) },
  };
}

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
  /** Can be gifted; bought again with store credit, it no longer could. */
  isGiftable: boolean;
  /** Purchase date, e.g. "2026-11-09". */
  createdAt?: string;
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
  /** Can be gifted now; bought again with store credit, it no longer could. */
  giftable: boolean;
  /** Purchase date of the pledge, e.g. "2026-11-09". */
  boughtOn?: string;
}

/**
 * An own paint already bought again with a higher discount (#139): the old pledge without it is
 * still in the hangar – the only open step is melting it.
 */
export interface ReboughtPaint {
  /** The old pledge, to melt. */
  old: OwnPaint;
  /** The new copy, bought with the higher discount. */
  copy: OwnPaint;
}

/** The plan kept when its paints were put into the cart (#103), to confirm paints bought again. */
export interface KeptPlan {
  /** When the paints were put into the cart, in ms. */
  at: number;
  /** The own paints of the plan, by pledge id. */
  ownPledgeIds: readonly number[];
}

/** A day "YYYY-MM-DD" of a time, in local time like the purchase dates. */
export const dayOf = (ms: number) => {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Whether a pair is confirmed by the kept plan: the old pledge was one of its own paints, and the
 * copy was bought on the day the paints were put into the cart or later.
 */
export function isConfirmedRebuy(pair: ReboughtPaint, kept: KeptPlan | undefined): boolean {
  if (!kept || !pair.copy.boughtOn) return false;
  return kept.ownPledgeIds.includes(pair.old.pledgeId) && pair.copy.boughtOn >= dayOf(kept.at);
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
  /** Own paints that would gain, left out because they can be gifted (`skipGiftable`). */
  giftableSkipped: number;
  /** Own paints already bought again: their old pledges are only left to melt (#139). */
  rebought: ReboughtPaint[];
  /**
   * Pairs that look bought again but aren't confirmed by a kept plan, with `reboughtDetection:
   * 'guess'`: shown as a guess to check; they stay in the plan.
   */
  probablyRebought: ReboughtPaint[];
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
  /** Leaves out own paints that can be gifted: bought again with store credit, they couldn't. */
  skipGiftable: boolean;
  /** The plan kept when its paints were put into the cart, if any. */
  keptPlan?: KeptPlan;
  /** Also guess paints bought again without a kept plan (shown, not acted on). */
  guessRebought?: boolean;
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
        giftable: pledge.isGiftable,
        ...(pledge.createdAt && { boughtOn: pledge.createdAt }),
      },
    ];
  });
}

/**
 * Own paints already bought again (#139): a copy of the same paint bought with the discount of a
 * tier, younger than an old pledge of it with less discount. Each copy is paired with exactly one
 * old pledge – the oldest one with less discount (pledge ids grow with the purchases); copies
 * without such a partner are normal own paints.
 */
export function findRebought(ownPaints: readonly OwnPaint[]): ReboughtPaint[] {
  const lowest = Math.min(...PAINT_DISCOUNT_TIERS.tiers.map((tier) => tier.percent));
  const bySku = new Map<number, OwnPaint[]>();
  for (const paint of ownPaints) {
    bySku.set(paint.storePaint.id, [...(bySku.get(paint.storePaint.id) ?? []), paint]);
  }
  const pairs: ReboughtPaint[] = [];
  for (const paints of bySku.values()) {
    if (paints.length < 2) continue;
    const byAge = [...paints].sort((a, b) => a.pledgeId - b.pledgeId);
    const paired = new Set<number>();
    // The youngest copies first: they are the ones bought again last.
    for (const copy of [...byAge].reverse()) {
      if (copy.discount < lowest || paired.has(copy.pledgeId)) continue;
      const old = byAge.find(
        (candidate) =>
          candidate.pledgeId < copy.pledgeId &&
          candidate.discount < copy.discount &&
          !paired.has(candidate.pledgeId),
      );
      if (!old) continue;
      paired.add(old.pledgeId).add(copy.pledgeId);
      pairs.push({ old, copy });
    }
  }
  return pairs.sort((a, b) => a.old.pledgeId - b.old.pledgeId);
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
  const owned = ownPaintsOf(input.pledges, storePaints);
  // Paints already bought again are no candidates: their old pledge is only left to melt, and the
  // new copy has its discount already.
  const pairs = findRebought(owned);
  const rebought = pairs.filter((pair) => isConfirmedRebuy(pair, input.keptPlan));
  const probablyRebought = input.guessRebought
    ? pairs.filter((pair) => !rebought.includes(pair))
    : [];
  const pairedIds = new Set(rebought.flatMap(({ old, copy }) => [old.pledgeId, copy.pledgeId]));
  const allOwn = owned.filter((paint) => !pairedIds.has(paint.pledgeId));
  const ownPaints = input.skipGiftable ? allOwn.filter((paint) => !paint.giftable) : allOwn;
  // Those that would gain at least at the best tier.
  const best = Math.max(...PAINT_DISCOUNT_TIERS.tiers.map((tier) => tier.percent));
  const giftableSkipped = input.skipGiftable
    ? allOwn.filter((paint) => paint.giftable && paint.discount < best).length
    : 0;
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
    giftableSkipped,
    rebought,
    probablyRebought,
    plan,
    next: next && { tier: next.tier, missing: usd(Math.max(0, missingOf(next))) },
  };
}

/** An own paint of a kept plan, as the plan keeps it. */
export interface KeptPaint {
  pledgeId: number;
  title: string;
  skuId: number;
}

/** A paint melted first that is left to buy again (#168). */
export interface PendingPaint {
  /** The melted pledge. */
  pledgeId: number;
  title: string;
  storePaint: StorePaint;
}

/** What is left to buy of a kept plan whose own paints were melted first (#168). */
export interface PendingRebuy {
  /** Own paints melted, not bought again yet. */
  toBuy: PendingPaint[];
  /** Melted paints the Pledge Store doesn't sell on their own any more. */
  unavailable: string[];
  /** The best tier the store credit pays now, with the filler paints for it. */
  plan?: Pick<PaintRebuyPlan, 'tier' | 'fillers' | 'cartPrice' | 'cartCost'>;
  /** The tier the plan had, when the store credit doesn't pay it now: what is missing. */
  missing?: MissingCredit;
}

/**
 * The own paints of a kept plan that are gone from the hangar – melted – and not bought again yet
 * (no younger copy of the same paint bought on the plan's day or later), and the best tier the
 * store credit pays for them now: the store credit their melting freed pays the cart. Undefined
 * when nothing is left to buy.
 */
export function planPendingRebuy(input: {
  kept: { at: number; tier: PaintTier; own: readonly KeptPaint[] };
  pledges: readonly PaintPledge[];
  storeItems: readonly StoreItem[];
  storeCredit: number;
  useFillers: boolean;
}): PendingRebuy | undefined {
  const storePaints = storePaintsOf(input.storeItems);
  const bySku = new Map(storePaints.map((paint) => [paint.id, paint]));
  const inHangar = new Set(input.pledges.map((pledge) => pledge.id));
  const keptIds = new Set(input.kept.own.map((paint) => paint.pledgeId));
  const since = dayOf(input.kept.at);
  // Copies bought since the plan, each counted for one melted paint.
  const copies = ownPaintsOf(input.pledges, storePaints).filter(
    (paint) => !keptIds.has(paint.pledgeId) && (paint.boughtOn ?? '') >= since,
  );
  const used = new Set<number>();

  const toBuy: PendingPaint[] = [];
  const unavailable: string[] = [];
  for (const kept of input.kept.own) {
    if (inHangar.has(kept.pledgeId)) continue;
    const copy = copies.find(
      (paint) => paint.storePaint.id === kept.skuId && !used.has(paint.pledgeId),
    );
    if (copy) {
      used.add(copy.pledgeId);
      continue;
    }
    const storePaint = bySku.get(kept.skuId);
    if (storePaint) toBuy.push({ pledgeId: kept.pledgeId, title: kept.title, storePaint });
    else unavailable.push(kept.title);
  }
  if (!toBuy.length && !unavailable.length) return undefined;

  // As own paints without melt value: their store credit is free already.
  const asOwn: OwnPaint[] = toBuy.map((paint) => ({
    ...paint,
    meltValue: 0,
    discount: 0,
    giftable: false,
  }));
  const credit = cents(Math.max(0, input.storeCredit));
  const tiers = [...PAINT_DISCOUNT_TIERS.tiers].sort((a, b) => b.percent - a.percent);
  const carts = tiers.flatMap((tier) => {
    const cart = asOwn.length ? cartAt(tier, asOwn, storePaints, input.useFillers) : undefined;
    return cart ? [cart] : [];
  });
  const cart = carts.find((candidate) => cents(candidate.cartCost) <= credit);
  const planned = carts.find((candidate) => candidate.tier.percent === input.kept.tier.percent);
  const missing =
    planned && (!cart || cart.tier.percent < planned.tier.percent)
      ? { tier: planned.tier, missing: usd(cents(planned.cartCost) - credit) }
      : undefined;
  return {
    toBuy,
    unavailable,
    ...(cart && {
      plan: {
        tier: cart.tier,
        fillers: cart.fillers,
        cartPrice: cart.cartPrice,
        cartCost: cart.cartCost,
      },
    }),
    ...(missing && { missing }),
  };
}

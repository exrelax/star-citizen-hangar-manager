import { PAINT_CONSULTANT, PAINT_DISCOUNT_TIERS } from '@/config';
import type { StoreItem } from '../items/store-items';
import { storePaintsOf, type FillerPaint, type PaintTier } from './calculation';
import type { CartLine, PaintCartLine } from './cart';

/*
 * The volume discount of the paints in RSI's cart (#458), for the note on RSI's cart page: the
 * tier the cart reaches, and the filler paints – the cheapest paints, as in the Paint Discount
 * Consultant (`calculation.ts`) – that would reach each higher one, what that costs and saves. RSI
 * counts the paints of the cart, also several of one; the Pledge Store's items tell which lines
 * are paints and their standard prices. Fillers are melted again after 24 hours and give back
 * what they cost, so a higher tier saves its extra discount on the paints in the cart.
 */

/** A higher tier, with the fillers that reach it. */
export interface CartTierOption {
  tier: PaintTier;
  fillers: FillerPaint[];
  /** How many filler paints that is. */
  fillerCount: number;
  /** What the cart's paints and the fillers cost after the tier's discount, in USD. */
  cost: number;
  /** What it saves on the cart's own paints compared to its tier now, in USD. */
  saves: number;
  /** The store credit missing for the cost; 0 if there is enough, unset if not known. */
  missing?: number;
}

export interface CartPaintDiscount {
  /** The paints in the cart, and their standard prices together. */
  paints: number;
  price: number;
  /** The tier the cart reaches now; none below the first one. */
  current?: PaintTier;
  /** Every tier, the lowest first. */
  tiers: readonly PaintTier[];
  /** The higher tiers that fillers can reach, the lowest first. */
  options: CartTierOption[];
  /** The best tier the store credit pays; none without one or without a known store credit. */
  best?: CartTierOption;
}

const cents = (usd: number) => Math.round(usd * 100);
const usd = (value: number) => value / 100;

/**
 * The cart's paints and how to reach a better tier; none without paints in the cart or once it
 * reaches the best tier. `credit`: the account's store credit in USD, unset if not known.
 */
export function cartPaintDiscount(
  cart: readonly CartLine[],
  storeItems: readonly StoreItem[],
  credit?: number,
): CartPaintDiscount | undefined {
  const tiers = [...PAINT_DISCOUNT_TIERS.tiers].sort((a, b) => a.paints - b.paints);
  const paintsById = new Map(
    storeItems.filter((item) => item.category === 'Paints').map((item) => [item.id, item]),
  );
  const inCart = new Map<number, number>();
  let paints = 0;
  let price = 0;
  for (const line of cart) {
    const item = paintsById.get(line.skuId);
    if (!item) continue;
    paints += line.qty;
    price += cents(item.price) * line.qty;
    inCart.set(line.skuId, (inCart.get(line.skuId) ?? 0) + line.qty);
  }
  if (!paints) return undefined;
  const current = [...tiers].reverse().find((tier) => paints >= tier.paints);
  if (current === tiers.at(-1)) return undefined;

  const cheapest = storePaintsOf(storeItems).sort(
    (a, b) => a.price - b.price || a.name.localeCompare(b.name),
  );
  const keep = (value: number, tier: PaintTier) => Math.round((value * (100 - tier.percent)) / 100);
  const options = tiers
    .filter((tier) => tier.paints > paints)
    .flatMap((tier): CartTierOption[] => {
      let needed = tier.paints - paints;
      const fillers: FillerPaint[] = [];
      for (const paint of cheapest) {
        if (!needed) break;
        const quantity = Math.min(
          needed,
          PAINT_CONSULTANT.maxPerItem - (inCart.get(paint.id) ?? 0),
        );
        if (quantity <= 0) continue;
        fillers.push({ paint, quantity });
        needed -= quantity;
      }
      if (needed) return [];
      const fillerPrice = fillers.reduce((sum, f) => sum + cents(f.paint.price) * f.quantity, 0);
      const cost = keep(price + fillerPrice, tier);
      const saves = keep(price, current ?? { paints: 0, percent: 0 }) - keep(price, tier);
      return [
        {
          tier,
          fillers,
          fillerCount: tier.paints - paints,
          cost: usd(cost),
          saves: usd(saves),
          ...(credit !== undefined && { missing: usd(Math.max(0, cost - cents(credit))) }),
        },
      ];
    });
  const best =
    credit === undefined ? undefined : [...options].reverse().find((option) => !option.missing);
  return { paints, price: usd(price), ...(current && { current }), tiers, options, best };
}

/** The fillers of an option as cart lines. */
export const fillerLinesOf = (option: CartTierOption): PaintCartLine[] =>
  option.fillers.map((filler) => ({
    skuId: filler.paint.id,
    name: filler.paint.name,
    qty: filler.quantity,
  }));

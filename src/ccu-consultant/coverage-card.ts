import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { ccuShips } from '@/hangar/upgrade-log';
import type { Ship } from '@/ships/ships';
import { createShipLookup } from '@/store/warbond';
import type { CoverageMatch } from './coverage';

/*
 * The details of an entry under "Base ship" (#426), shown as a card on hover: a CCU with both of
 * its ships, a ship pledge with its ship – each ship with its image and standard price from the
 * upgrade tool –, what the pledge is worth (in the buy back: what buying it back costs), its
 * discount against the ships' prices and whether it is giftable.
 */

export interface CardShip {
  name: string;
  image?: string;
  /** Standard price in USD, if the upgrade tool knows the ship. */
  price?: number;
}

export interface CoverageCard {
  /** A CCU's base and target ship, or the ships of a ship pledge (usually one). */
  from?: CardShip;
  to?: CardShip;
  ships: CardShip[];
  /** What the pledge is worth in USD, in the buy back what buying it back costs; if known. */
  value?: number;
  /** Against the ships' prices, negative for a surcharge; if both are known. */
  discount?: { amount: number; percent: number };
  /** Giftable in the hangar; in the buy back probably giftable when bought back with money. */
  giftable: boolean;
}

export type CardPledge =
  { source: 'hangar'; pledge: PledgeView } | { source: 'buyback'; pledge: BuybackView };

const round = (value: number) => Math.round(value * 100) / 100;

/** The discount of a value against an original price; none without both. */
function discountOf(original: number | undefined, value: number | undefined) {
  if (original === undefined || value === undefined || original <= 0) return undefined;
  const amount = round(original - value);
  return { amount, percent: round((amount / original) * 100) };
}

/** The card of an entry under "Base ship", from its pledge and the upgrade tool's ships. */
export function coverageCard(
  match: CoverageMatch,
  entry: CardPledge,
  ships: readonly Ship[],
): CoverageCard {
  const lookup = createShipLookup(ships);
  const byId = new Map(ships.map((ship) => [ship.id, ship]));
  const shipOf = (name: string | undefined, id?: number): CardShip | undefined => {
    const ship =
      (id !== undefined ? byId.get(id) : undefined) ?? (name ? lookup.shipOf(name) : undefined);
    if (!ship && !name) return undefined;
    return {
      name: ship?.name ?? name!,
      ...(ship?.image && { image: ship.image }),
      ...(ship && { price: ship.msrp }),
    };
  };

  if (entry.source === 'hangar') {
    const { pledge } = entry;
    if (match.kind === 'ccu') {
      const names = ccuShips(pledge.title);
      const from = shipOf(pledge.upgrade?.matchItems[0]?.name ?? names?.from);
      const to = shipOf(pledge.upgrade?.targetItems[0]?.name ?? names?.to);
      return {
        ...(from && { from }),
        ...(to && { to }),
        ships: [],
        value: pledge.valueUsd,
        ...(pledge.discount && {
          discount: { amount: pledge.discount.amount, percent: pledge.discount.percent },
        }),
        giftable: pledge.isGiftable,
      };
    }
    const names = [
      ...new Set(pledge.items.filter((item) => item.kind === 'Ship').map((item) => item.title)),
    ];
    return {
      ships: names.flatMap((name) => shipOf(name) ?? []),
      value: pledge.valueUsd,
      ...(pledge.discount && {
        discount: { amount: pledge.discount.amount, percent: pledge.discount.percent },
      }),
      giftable: pledge.isGiftable,
    };
  }

  const { pledge } = entry;
  const value = pledge.price?.amount;
  if (match.kind === 'ccu') {
    const names = ccuShips(pledge.title);
    const from = shipOf(names?.from, pledge.upgrade?.fromShipId);
    const to = shipOf(names?.to, pledge.upgrade?.toShipId);
    const original =
      from?.price !== undefined && to?.price !== undefined ? to.price - from.price : undefined;
    const discount = discountOf(original, value);
    return {
      ...(from && { from }),
      ...(to && { to }),
      ships: [],
      ...(value !== undefined && { value }),
      ...(discount && { discount }),
      giftable: pledge.isProbablyGiftable,
    };
  }
  const cardShips = pledge.ships.flatMap((ship) => shipOf(ship.name) ?? []);
  // Compared with the ship's price only for a pledge with just that ship.
  const discount =
    cardShips.length === 1 && pledge.isStandaloneShip
      ? discountOf(cardShips[0]!.price, value)
      : undefined;
  return {
    ships: cardShips,
    ...(value !== undefined && { value }),
    ...(discount && { discount }),
    giftable: pledge.isProbablyGiftable,
  };
}

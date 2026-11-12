import type { BuybackView } from '@/buyback/buyback-view';
import type { BuybackPrice } from '@/buyback/buyback-price';
import type { Ship, ShipSku, WarbondSku } from '@/ships/ships';
import { cheapestBases, createShipLookup, type BaseShip, type Holdings } from '@/store/warbond';
import { upcomingPriceIncreases, type ExpectedPriceIncrease } from './price-increases';

/*
 * The CCUs to secure before a price increase (#253, part of the Price Increase Advisor #248), for
 * the Pledge Store tab – for every user, whether or not the hangar has CCUs to the ship. For each
 * ship whose price is expected to rise and to which RSI sells CCUs right now: the cheapest CCUs to
 * it from the ships below its price (the upgrade tool's data, like the warbond CCUs). A CCU bought
 * now gains what the ship rises by: its upgrade value grows, its price doesn't. Ships about to rise
 * themselves are left out as base ships. Gone once the price increase is past.
 *
 * A ship RSI doesn't sell CCUs to right now is listed only if the buy back has CCUs to it (#311):
 * bought back before the increase, they gain the same. RSI's buy back can't sell a CCU whose base
 * ship costs as much as its target or more (#207), so those are left out.
 */

/** The buy back's CCUs from one base ship to a rising ship (#311). */
export interface BuybackCcuGroup {
  /** The base ship in the upgrade tool, if known; else only its name. */
  fromShip?: Ship;
  fromName: string;
  /** What buying one back costs (#185), if known; the cheapest of the group. */
  price?: BuybackPrice;
  /** How many of them the buy back has. */
  count: number;
}

export interface SecureOffer {
  increase: ExpectedPriceIncrease;
  /** The rising ship in the upgrade tool. */
  ship: Ship;
  /**
   * The SKU RSI sells CCUs to it with (not the warbond edition), for RSI's upgrade dialog; none
   * while RSI doesn't sell CCUs to it (#311).
   */
  skuId?: number;
  /** Its standard price today. */
  price: number;
  /** What each CCU gains in discount: what the ship rises by, if known. */
  gain?: number;
  /** The ships with the cheapest CCUs to it, cheapest CCU first; none while not on sale. */
  bases: BaseShip[];
  /** Not on sale (#311): the buy back's CCUs to it, by base ship, cheapest first. */
  buyback?: BuybackCcuGroup[];
}

export interface SecureInput {
  increases: readonly ExpectedPriceIncrease[];
  ships: readonly Ship[];
  buyable: readonly ShipSku[];
  warbonds: readonly WarbondSku[];
  /** How often each ship (by id) is in the hangar and the buy back. */
  holdings?: ReadonlyMap<number, Holdings>;
  /** The buy back, for the CCUs to ships not on sale (#311). */
  buyback?: readonly BuybackView[];
  now: number;
}

/** The base ship's name in a CCU's title, e.g. "Upgrade - Cutlass Black to Corsair". */
const CCU_BASE = /^(?:upgrade\s*-\s*)?(.+?)\s+to\s+/i;
/** The target ship's name in a CCU's title. */
const CCU_TARGET = /\bto\s+(.+?)(?:\s+(?:warbond|standard)\s+edition)?\s*$/i;

/** The CCUs to secure, the next price increase first; one entry per ship (its next increase). */
export function ccusToSecure(input: SecureInput): SecureOffer[] {
  const upcoming = upcomingPriceIncreases(input.increases, input.now);
  const byId = new Map(input.ships.map((ship) => [ship.id, ship]));
  const lookup = createShipLookup(input.ships);
  /** The upgrade tool's ship of an increase: by id, else by name (as the advice does). */
  const shipOf = (increase: ExpectedPriceIncrease) =>
    byId.get(increase.ship.id) ?? lookup.shipOf(increase.ship.name);
  const rising = new Set(upcoming.flatMap((increase) => shipOf(increase)?.id ?? []));
  const bases = input.ships.filter((ship) => !rising.has(ship.id));
  const warbondSkus = new Set(input.warbonds.map((warbond) => warbond.skuId));
  const seen = new Set<number>();

  /** The buy back's CCUs to `ship` that RSI can sell again, grouped by base ship. */
  function buybackCcusTo(ship: Ship): BuybackCcuGroup[] {
    const groups = new Map<string, BuybackCcuGroup>();
    for (const pledge of input.buyback ?? []) {
      if (!pledge.isCcu || pledge.unavailable) continue;
      const targetName = CCU_TARGET.exec(pledge.title)?.[1];
      const targetId = pledge.upgrade?.toShipId ?? (targetName && lookup.shipOf(targetName)?.id);
      if (targetId !== ship.id) continue;
      const fromShip = pledge.upgrade
        ? byId.get(pledge.upgrade.fromShipId)
        : lookup.shipOf(CCU_BASE.exec(pledge.title)?.[1] ?? '');
      const fromName = fromShip?.name ?? CCU_BASE.exec(pledge.title)?.[1]?.trim() ?? pledge.title;
      const group = groups.get(fromName) ?? { fromName, count: 0, ...(fromShip && { fromShip }) };
      group.count++;
      if (pledge.price && (!group.price || pledge.price.amount < group.price.amount)) {
        group.price = pledge.price;
      }
      groups.set(fromName, group);
    }
    // The cheapest first, those without a known price last.
    return [...groups.values()].sort(
      (a, b) =>
        (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity) ||
        a.fromName.localeCompare(b.fromName),
    );
  }
  return upcoming.flatMap((increase): SecureOffer[] => {
    const ship = shipOf(increase);
    if (!ship || seen.has(ship.id)) return [];
    seen.add(ship.id);
    // RSI sells standard CCUs to it right now, else the buy back may have some (#311).
    const sku = input.buyable.find(
      (entry) => entry.shipId === ship.id && !warbondSkus.has(entry.skuId),
    );
    const price = ship.msrp;
    const gain =
      increase.price && Math.round((increase.price.to - increase.price.from) * 100) / 100;
    const common = { increase, ship, price, ...(gain && gain > 0 && { gain }) };
    // Only while it is known which ships RSI sells CCUs to.
    if (!sku && !input.buyable.length) return [];
    if (!sku) {
      const buyback = buybackCcusTo(ship);
      return buyback.length ? [{ ...common, bases: [], buyback }] : [];
    }
    return [
      {
        ...common,
        skuId: sku.skuId,
        bases: cheapestBases(bases, { ship, skuId: sku.skuId, price }, input.holdings),
      },
    ];
  });
}

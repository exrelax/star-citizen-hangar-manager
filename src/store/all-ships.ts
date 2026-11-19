import type { BuybackView } from '@/buyback/buyback-view';
import { ccusByShip, ccusIn } from '@/hangar/ccus-by-ship';
import type { PledgeView } from '@/hangar/pledge-view';
import type { ExpectedPriceIncrease } from '@/price-increases/price-increases';
import type { ShipRemoval } from '@/ship-removals/ship-removals';
import type { ShipFactsLookup } from '@/ships/ship-facts';
import { standardSku, warbondSku, type Ship, type ShipSku, type WarbondSku } from '@/ships/ships';
import { createShipLookup } from './warbond';

/*
 * The table of all ships of the Pledge Store tab (#385): every ship of RSI's upgrade tool by its
 * value, highest first, with its warbond price, whether it is always available and sold at all
 * (the ship facts, #109), what of it the hangar and the buy back have, and whether it is on sale
 * now (with the SKUs for RSI's upgrade dialog). CCUs are matched as everywhere (`ccusByShip`);
 * standalone ships by their name in the upgrade tool. A ship also shows its next price increase
 * and whether it leaves the Pledge Store (#410), both matched by its id.
 */

export interface AllShipsRow {
  ship: Ship;
  /** From the ship facts, if they know the ship. */
  manufacturer?: string;
  /** The current warbond price, while there is a warbond discount. */
  warbondPrice?: number;
  /** From the ship facts; `undefined` without them. */
  alwaysAvailable?: boolean;
  /** RSI sells it at all; `undefined` while that isn't known. */
  purchasable?: boolean;
  hangarFrom: number;
  hangarTo: number;
  buybackFrom: number;
  buybackTo: number;
  hangarShips: number;
  buybackShips: number;
  /** On sale now: its standard SKU and warbond SKU for "Ship upgrade" and "Warbond upgrade". */
  skuId?: number;
  warbondSkuId?: number;
  /** Its next price increase still ahead (#410). */
  priceIncrease?: ExpectedPriceIncrease;
  /** It leaves the Pledge Store (#410). */
  removal?: ShipRemoval;
}

export interface AllShipsInput {
  ships: readonly Ship[];
  buyable: readonly ShipSku[];
  warbonds: readonly WarbondSku[];
  facts?: ShipFactsLookup;
  hangar: readonly PledgeView[];
  buyback: readonly BuybackView[];
  /** The price increases and ship removals still ahead, the next first. */
  increases?: readonly ExpectedPriceIncrease[];
  removals?: readonly ShipRemoval[];
}

/** The first entry of each ship: of a list with the next first, its next one. */
function firstByShip<T extends { ship: { id: number } }>(list: readonly T[] = []) {
  const byShip = new Map<number, T>();
  for (const entry of list) if (!byShip.has(entry.ship.id)) byShip.set(entry.ship.id, entry);
  return byShip;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** Every ship of the upgrade tool, by value (highest first), ships of equal value by name. */
export function allShips(input: AllShipsInput): AllShipsRow[] {
  const lookup = createShipLookup(input.ships);
  const ccus = ccusByShip({ ...input, targets: input.ships });
  const standalone = (names: readonly string[], counts: Map<number, number>) => {
    for (const id of new Set(names.map((name) => lookup.shipOf(name)?.id))) {
      if (id !== undefined) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  };
  const hangarShips = new Map<number, number>();
  for (const pledge of input.hangar) {
    if (!pledge.isStandaloneShip) continue;
    standalone(
      pledge.items.filter((item) => item.kind === 'Ship').map((item) => item.title),
      hangarShips,
    );
  }
  const increases = firstByShip(input.increases);
  const removals = firstByShip(input.removals);
  const buybackShips = new Map<number, number>();
  for (const pledge of input.buyback) {
    if (pledge.isStandaloneShip)
      standalone(
        pledge.ships.map((ship) => ship.name),
        buybackShips,
      );
  }

  return input.ships
    .map((ship): AllShipsRow => {
      const { from, to } = ccus.get(ship.id)!;
      const warbond = warbondSku(input.warbonds, ship.id);
      const sku = standardSku(input, ship.id);
      const alwaysAvailable = input.facts?.isAlwaysAvailable(ship.id);
      const purchasable = input.facts?.isPurchasable(ship.id);
      const manufacturer = input.facts?.ship(ship.id)?.manufacturer;
      const priceIncrease = increases.get(ship.id);
      const removal = removals.get(ship.id);
      return {
        ship,
        ...(manufacturer && { manufacturer }),
        ...(warbond && warbond.price < ship.msrp && { warbondPrice: warbond.price }),
        ...(alwaysAvailable !== undefined && { alwaysAvailable }),
        ...(purchasable !== undefined && { purchasable }),
        hangarFrom: ccusIn(from, 'hangar'),
        hangarTo: ccusIn(to, 'hangar'),
        buybackFrom: ccusIn(from, 'buyback'),
        buybackTo: ccusIn(to, 'buyback'),
        hangarShips: hangarShips.get(ship.id) ?? 0,
        buybackShips: buybackShips.get(ship.id) ?? 0,
        ...(sku && { skuId: sku.skuId }),
        ...(warbond && { warbondSkuId: warbond.skuId }),
        ...(priceIncrease && { priceIncrease }),
        ...(removal && { removal }),
      };
    })
    .sort((a, b) => b.ship.msrp - a.ship.msrp || collator.compare(a.ship.name, b.ship.name));
}

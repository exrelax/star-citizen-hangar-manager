import type { Ship } from '@/ships/ships';
import type { ShipRemoval } from '@/ship-removals/ship-removals';
import type { BaseShipGroup, BaseShipList } from './base-ship-list';
import type { ChainCoverage, ChainShip, WayKind } from './chain-coverage';

/*
 * The deep view of the CCU Consultant (#563): a row per base ship with its ways by the chain rule
 * (`chain-coverage.ts`) as a bar of one segment per CCU from it, and what securing the missing
 * CCUs costs now – a CCU from the next cheaper always available ship (safe: that ship can be had
 * any time) and from the next cheaper ship (cheapest, but that ship may need a way itself), at the
 * difference of the standard prices of RSI's upgrade tool. Above the rows of "Too few ways" the
 * totals of the base ships on sale now.
 */

/** A part of a row's bar: a kind of way, the CCUs an always available ship serves, or too few. */
export type SegmentKind = WayKind | 'always' | 'short';

export interface Segment {
  kind: SegmentKind;
  count: number;
}

/** A CCU to the base ship from a cheaper ship, to secure a CCU from it now. */
export interface SecureOption {
  from: Ship;
  /** What one CCU costs: the difference of the standard prices. */
  each: number;
  /** The start ship is always available (#110). */
  always: boolean;
}

export interface SecureOptions {
  /** From the next cheaper always available ship; none without one (or not considered). */
  always?: SecureOption;
  /** From the next cheaper ship; none if it is the always available one at the same price. */
  cheapest?: SecureOption;
  /** Whether always available ships are considered at all. */
  considered: boolean;
}

export interface DeepRow {
  ship: ChainShip;
  /** The upgrade tool's ship, for its price, image and page. */
  info?: Ship;
  /** RSI sells it now: its standard SKU is on sale. */
  onSale: boolean;
  skuId?: number;
  removal?: ShipRemoval;
  /** The bar's parts, in its order; one segment per CCU from it. */
  segments: Segment[];
  /** How many CCUs to secure now: those short of ways, in "Only via buy back" those it gives. */
  need: number;
  options: SecureOptions;
}

export interface DeepSources {
  ships: readonly Ship[];
  /** Its standard SKU while on sale. */
  skuOf: (shipId: number) => number | undefined;
  /** Whether a ship counts as always available; none while not considered. */
  isAlways?: (shipId: number) => boolean;
  /** The ships leaving the Pledge Store that can still be had now (#454). */
  leaving: ReadonlyMap<number, ShipRemoval>;
}

/** The parts of a ship's bar: its ways up to its CCUs, then always available or too few. */
export function segmentsOf(ship: ChainShip): Segment[] {
  let left = ship.ccus.length;
  const take = (kind: SegmentKind, count: number): Segment => {
    const taken = Math.min(left, count);
    left -= taken;
    return { kind, count: taken };
  };
  const parts = [
    take('ship', ship.ways.ship),
    take('chain', ship.ways.chain),
    take('buyback', ship.ways.buyback),
  ];
  parts.push(take(ship.always ? 'always' : 'short', left));
  return parts.filter((part) => part.count > 0);
}

/**
 * The ships a CCU to a base ship can start from to secure one now: the pricier the cheaper, as a
 * CCU costs the difference of the standard prices. On equal prices an always available ship wins,
 * then the name.
 */
export function secureOptions(
  base: Pick<Ship, 'id' | 'msrp'> | undefined,
  ships: readonly Ship[],
  isAlways: ((shipId: number) => boolean) | undefined,
): SecureOptions {
  const considered = isAlways !== undefined;
  if (!base || !(base.msrp > 0)) return { considered };
  const cheaper = ships
    .filter((ship) => ship.id !== base.id && ship.msrp > 0 && ship.msrp < base.msrp)
    .map((ship) => ({ ship, always: isAlways?.(ship.id) === true }))
    .sort(
      (a, b) =>
        b.ship.msrp - a.ship.msrp ||
        Number(b.always) - Number(a.always) ||
        a.ship.name.localeCompare(b.ship.name, 'en'),
    );
  const option = (entry: (typeof cheaper)[number] | undefined): SecureOption | undefined =>
    entry && { from: entry.ship, each: base.msrp - entry.ship.msrp, always: entry.always };
  const always = option(cheaper.find((entry) => entry.always));
  const cheapest = option(cheaper[0]);
  return {
    considered,
    ...(always && { always }),
    ...(cheapest && !(always && cheapest.each === always.each) && { cheapest }),
  };
}

/** The base ships of a group in the deep view, in its order. */
export function deepShips(
  chains: ChainCoverage,
  list: BaseShipList,
  group: BaseShipGroup,
): ChainShip[] {
  if (group === 'missing') return chains.tooFew;
  return list.groups[group].flatMap((row) => chains.ships.get(row.key) ?? []);
}

/** The rows of a group: in "Too few ways" those on sale first. */
export function deepRows(
  ships: readonly ChainShip[],
  group: BaseShipGroup,
  sources: DeepSources,
): DeepRow[] {
  const byId = new Map(sources.ships.map((ship) => [ship.id, ship]));
  const rows = ships.map((ship): DeepRow => {
    const info = ship.shipId !== undefined ? byId.get(ship.shipId) : undefined;
    const skuId = ship.shipId !== undefined ? sources.skuOf(ship.shipId) : undefined;
    const removal = ship.shipId !== undefined ? sources.leaving.get(ship.shipId) : undefined;
    const own = Math.min(ship.ccus.length, ship.ways.ship + ship.ways.chain);
    return {
      ship,
      ...(info && { info }),
      onSale: skuId !== undefined,
      ...(skuId !== undefined && { skuId }),
      ...(removal && { removal }),
      segments: segmentsOf(ship),
      need: ship.always ? 0 : group === 'buyback' ? ship.ccus.length - own : ship.short,
      options: secureOptions(info, sources.ships, sources.isAlways),
    };
  });
  if (group !== 'missing') return rows;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => Number(b.row.onSale) - Number(a.row.onSale) || a.index - b.index)
    .map(({ row }) => row);
}

/** "Secure now": the CCUs to secure on base ships on sale now and what each way costs in all. */
export interface SecureSummary {
  ccus: number;
  ships: number;
  /** From the next cheaper always available ship, for the base ships that have one. */
  always?: { total: number; ships: number };
  /** From the next cheaper ship. */
  cheapest?: { total: number; ships: number };
}

export function secureSummary(rows: readonly DeepRow[]): SecureSummary {
  const onSale = rows.filter((row) => row.onSale && row.need > 0);
  const sum = (pick: (row: DeepRow) => number | undefined) => {
    const priced = onSale.flatMap((row) => {
      const each = pick(row);
      return each === undefined ? [] : [each * row.need];
    });
    return priced.length
      ? { total: priced.reduce((total, cost) => total + cost, 0), ships: priced.length }
      : undefined;
  };
  const always = sum((row) => row.options.always?.each);
  // The cheapest is the always available ship where no other is cheaper.
  const cheapest = sum((row) => (row.options.cheapest ?? row.options.always)?.each);
  return {
    ccus: onSale.reduce((total, row) => total + row.need, 0),
    ships: onSale.length,
    ...(always && { always }),
    ...(cheapest && { cheapest }),
  };
}

/** Every CCU of the rows, once each (for "Show N CCUs in My Hangar"). */
export const deepCcuIds = (ships: readonly ChainShip[]): number[] => [
  ...new Set(ships.flatMap((ship) => ship.ccus)),
];

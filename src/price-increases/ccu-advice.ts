import type { PledgeView } from '@/hangar/pledge-view';
import type { Ship, ShipSku, WarbondSku } from '@/ships/ships';
import { createShipLookup } from '@/store/warbond';
import type { ExpectedPriceIncrease } from './price-increases';

/*
 * Advice for the CCUs of My Hangar whose base ship rises in price (#252, part of the Price
 * Increase Advisor #248): they lose upgrade value, and with it their discount.
 *
 * With the new price known, the advice is to melt them before the increase and buy, with the store
 * credit they give back, as many CCUs **to the ship that rises**: their upgrade value grows with
 * the increase, so they gain the discount the old ones lose. Example: the Prospector rises from
 * $155 to $175. 8 CCUs Prospector → Vulture ($175) bought for $5 each have $15 of discount today
 * and −$5 after. Melted, they give back $5 each – enough for 8 CCUs Freelancer MAX ($150) →
 * Prospector for $5, whose upgrade value is $25 after the increase: $20 of discount each.
 *
 * The base ship of the new CCUs (#263) is one the user can always get onto later, to apply the
 * CCU: the most expensive ship below the rising one that is always available in the Pledge Store
 * (the website's ship facts, #109). Without such a ship, the most expensive one on sale right now,
 * with a note that it may not be later; without any on sale, simply the most expensive one. The
 * base ships between it and the rising ship (cheaper CCUs) are the alternatives. For each, the
 * advice counts how many of the base ship, CCUs to it and buy back CCUs to it the user has. Ships
 * about to rise themselves are left out. It is
 * recommended only if the new CCUs have more discount after the increase than the old ones, and
 * only while RSI sells standard CCUs to the rising ship (paid with store credit).
 *
 * Without the new price nothing is recommended: a CCU with a discount may lose it (a warning), and
 * a target ship still in concept will probably rise too once it is flight ready (an information).
 * A suggestion only: the extension never melts or buys by itself.
 */

/** How the recommended base ship was chosen. */
export type CcuBaseChoice = 'alwaysAvailable' | 'onSale' | 'any';

/** What the user has of a base ship: the ship in My Hangar, CCUs to it there and in the buy back. */
export interface BaseHoldings {
  hangarShips: number;
  hangarCcus: number;
  buybackCcus: number;
}

/** A cheaper CCU to the rising ship, from a base ship that isn't always available. */
export interface CcuAlternative {
  from: Ship;
  /** Price of one CCU in USD, before the increase. */
  price: number;
  holdings: BaseHoldings;
}

/** Buying CCUs to the rising ship instead. */
export interface CcuSwitch {
  /** The base ship of the new CCUs. */
  from: Ship;
  /** How it was chosen: always available, on sale right now, or neither known. */
  choice: CcuBaseChoice;
  holdings: BaseHoldings;
  /** Cheaper CCUs from the base ships between `from` and the rising ship, cheapest first. */
  alternatives: CcuAlternative[];
  /** The ship that rises: the target of the new CCUs. */
  to: Ship;
  /** Price of one new CCU in USD, before the increase. */
  price: number;
  /** Price of all of them. */
  total: number;
  /** Upgrade value of one new CCU after the increase. */
  upgradeValueAfter: number;
  /** Discount of one new CCU after the increase: what the ship rises by. */
  discountAfter: number;
  /** Store credit needed besides what melting the old CCUs gives back. */
  storeCreditNeeded: number;
  /** With a known store credit: whether it is enough. */
  enoughStoreCredit?: boolean;
  /** How much more discount all new CCUs have after the increase than the old ones. */
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
  /** The increase of the CCUs' base ship. */
  increase: ExpectedPriceIncrease;
  /** The base ship in the upgrade tool, if found (for its image). */
  base?: Ship;
  target: Ship;
  /** The CCUs losing value, newest first. */
  ccus: PledgeView[];
  /** What melting all of them gives back in store credit. */
  meltValue: number;
  /** How many of them can be gifted now – bought again with store credit, the new ones can't. */
  giftable: number;
  /** With the new price known. */
  keep?: CcuAdviceKeep;
  /** Their discount today from the standard prices, if known (without the new price too). */
  discountNow?: number;
  /** The target ship is still in concept: it will probably rise too once it is flight ready. */
  targetInConcept: boolean;
  /** The recommendation, with the new price known. */
  switch?: CcuSwitch;
  /** With the new price known but no recommendation: why. */
  noSwitch?: 'notSold' | 'keepIsBetter';
}

export interface CcuAdviceInput {
  /** The pledges of My Hangar; only CCUs whose base ship rises count. */
  pledges: readonly PledgeView[];
  /** The upgrade tool: every ship, the SKUs on sale and the warbond editions. */
  ships: readonly Ship[];
  buyable: readonly ShipSku[];
  warbonds: readonly WarbondSku[];
  /** Ships (by id) whose price is about to rise: no base ship for new CCUs. */
  risingShipIds?: ReadonlySet<number>;
  /** Ships (by id) still in concept, from the Ship Matrix. */
  inConceptShipIds?: ReadonlySet<number>;
  /** The account's store credit in USD, if known. */
  storeCredit?: number;
  /** Whether a ship (by id) is always available in the Pledge Store; `undefined`: unknown. */
  isAlwaysAvailable?: (id: number) => boolean | undefined;
  /** What the user has of a ship (by id), see `BaseHoldings`. */
  holdingsOf?: (id: number) => BaseHoldings;
}

const cents = (value: number) => Math.round(value * 100) / 100;
const sum = (values: readonly number[]) => cents(values.reduce((total, value) => total + value, 0));

const NO_HOLDINGS: BaseHoldings = { hangarShips: 0, hangarCcus: 0, buybackCcus: 0 };

/**
 * The base ship for CCUs to the rising ship and the alternatives (see above): `candidates` are the
 * ships below its price, the most expensive (the cheapest CCU) first.
 */
export function chooseBase(
  candidates: readonly Ship[],
  isAlwaysAvailable: (id: number) => boolean | undefined,
  isOnSale: (id: number) => boolean,
): { from: Ship; choice: CcuBaseChoice; cheaper: Ship[] } | undefined {
  const always = candidates.find((ship) => isAlwaysAvailable(ship.id) === true);
  const onSale = always ? undefined : candidates.find((ship) => isOnSale(ship.id));
  const from = always ?? onSale ?? candidates[0];
  if (!from) return undefined;
  const choice: CcuBaseChoice = always ? 'alwaysAvailable' : onSale ? 'onSale' : 'any';
  return { from, choice, cheaper: candidates.filter((ship) => ship.msrp > from.msrp) };
}

/** The advice for every pair of rising base ship and target, the next price increase first. */
export function ccuAdvice(input: CcuAdviceInput): CcuAdviceGroup[] {
  const { ships, buyable, warbonds, storeCredit } = input;
  const isAlwaysAvailable = input.isAlwaysAvailable ?? (() => undefined);
  const holdingsOf = input.holdingsOf ?? (() => NO_HOLDINGS);
  const onSale = new Set(buyable.map((sku) => sku.shipId));
  const risingShipIds = input.risingShipIds ?? new Set<number>();
  const inConcept = input.inConceptShipIds ?? new Set<number>();
  const lookup = createShipLookup(ships);
  const byId = new Map(ships.map((ship) => [ship.id, ship]));
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
      const base = byId.get(increase.ship.id) ?? lookup.shipOf(increase.ship.name);
      const amounts = ccus.map((ccu) => ccu.ccuPriceChange?.amounts);
      const keep: CcuAdviceKeep | undefined = amounts.every((amount) => amount !== undefined)
        ? {
            upgradeValueNow: sum(amounts.map((amount) => amount!.before)),
            upgradeValueAfter: sum(amounts.map((amount) => amount!.after)),
            discountNow: cents(sum(amounts.map((amount) => amount!.before)) - meltValue),
            discountAfter: cents(sum(amounts.map((amount) => amount!.after)) - meltValue),
          }
        : undefined;
      // Today's discount from the standard prices, also without the new price.
      const basePrice = base?.msrp ?? increase.price?.from;
      const discountNow =
        keep?.discountNow ??
        (basePrice !== undefined && target.msrp > basePrice
          ? cents((target.msrp - basePrice) * count - meltValue)
          : undefined);

      const group: CcuAdviceGroup = {
        increase,
        ...(base && { base }),
        target,
        ccus,
        meltValue,
        giftable: ccus.filter((ccu) => ccu.isGiftable).length,
        ...(keep && { keep }),
        ...(discountNow !== undefined && { discountNow }),
        targetInConcept: inConcept.has(target.id),
      };

      const price = increase.price;
      if (!price) return group;
      // RSI sells standard CCUs (with store credit) to ships on sale in another edition.
      const sold =
        !!base && buyable.some((sku) => sku.shipId === base.id && !warbondSkus.has(sku.skuId));
      const rising = new Set([...risingShipIds, increase.ship.id]);
      const candidates = ships
        .filter(
          (ship) =>
            ship.id !== base?.id && !rising.has(ship.id) && ship.msrp > 0 && ship.msrp < price.from,
        )
        // The most expensive base first: its CCU is the cheapest.
        .sort((a, b) => b.msrp - a.msrp || a.name.localeCompare(b.name));
      const chosen =
        base && sold
          ? chooseBase(candidates, isAlwaysAvailable, (id) => onSale.has(id))
          : undefined;
      if (!base || !chosen) return { ...group, noSwitch: 'notSold' };
      const { from, choice } = chosen;

      const ccuPrice = cents(price.from - from.msrp);
      const total = cents(ccuPrice * count);
      const discountAfter = cents(price.to - price.from);
      const storeCreditNeeded = Math.max(0, cents(total - meltValue));
      const gain = keep ? cents(discountAfter * count - keep.discountAfter) : undefined;
      if (gain !== undefined && gain <= 0) return { ...group, noSwitch: 'keepIsBetter' };
      return {
        ...group,
        switch: {
          from,
          choice,
          holdings: holdingsOf(from.id),
          // Cheapest first.
          alternatives: chosen.cheaper.map((ship) => ({
            from: ship,
            price: cents(price.from - ship.msrp),
            holdings: holdingsOf(ship.id),
          })),
          to: base,
          price: ccuPrice,
          total,
          upgradeValueAfter: cents(price.to - from.msrp),
          discountAfter,
          storeCreditNeeded,
          ...(storeCredit !== undefined && { enoughStoreCredit: storeCredit >= storeCreditNeeded }),
          ...(gain !== undefined && { gain }),
        },
      };
    })
    .sort(
      (a, b) =>
        a.increase.priceIncreaseAt.at - b.increase.priceIncreaseAt.at ||
        a.target.name.localeCompare(b.target.name),
    );
}

import { PAINT_DISCOUNT_TIERS } from '@/config';
import { hangarCcuContents } from '@/hangar/ccu-contents';
import { isAtLeast, parseInsurance, type Insurance } from '@/hangar/insurance';
import { meltableAt } from '@/hangar/melt-marks';
import type { PledgeView } from '@/hangar/pledge-view';
import { roundToPaintTier } from '@/hangar/ship-prices';
import { pledgeShipKind } from '@/hangar/ship-kind';
import { ccuShips } from '@/hangar/upgrade-log';
import type { Purchase } from '@/hangar/use-melt-marks';
import { refundWindow } from '@/orders/refund';
import { nameKey } from '@/price-increases/price-increase-match';
import type { ExpectedPriceIncrease } from '@/price-increases/price-increases';
import type { ShipRemoval } from '@/ship-removals/ship-removals';
import type { DayOrTime } from '@/site-data/site-data';
import { standardSku, type Ship } from '@/ships/ships';
import { storeNameOf } from '@/store/items/item-prices';
import type { StoreItem } from '@/store/items/store-items';
import { createShipLookup } from '@/store/warbond';
import type { StoreCatalog } from '@/watchlists/store-status';
import type { WatchInsurance } from '@/watchlists/watchlists';

/*
 * Melt and Rebuy (#527, #528): whether a pledge of My Hangar can be melted now and bought again
 * later with store credit without losing anything – the same item, the same insurance or a better
 * one, for its value or less – and if not, every reason why. Only from what the extension knows
 * already (no requests to RSI):
 *
 * - **Meltable now**: RSI offers the exchange (`isMeltable`), not protected game access, no
 *   reward, bought at least 24 hours ago (`meltableAt`, by the pledge log's time or the list's day).
 * - **Not giftable**: RSI's gift flag. Bought with store credit it never is again.
 * - **No refund lost**: a pledge paid with money still in its refund period (`refundWindow`).
 * - **One plain item**: a single paint, a solo ship (#514) that isn't upgraded, an unapplied CCU
 *   without extras (#566). Packages with game access, ship packs, upgraded pledges and pledges
 *   with extra items (also several paints) don't count, nor gear, flair, add-ons, ….
 * - **On sale now as exactly this item**, at a known standard price:
 *   - a paint: the Pledge Store item of its name (`storeNameOf`), not a warbond one, in stock;
 *   - a ship: a "Standalone Ships" item of the store, not a warbond one, in stock – the item of
 *     the pledge's own title ("Pitbull - 10 Year"), or one named like the ship with nothing but an
 *     insurance after it ("Avenger Titan", "Avenger Titan - LTI");
 *   - a CCU: RSI's upgrade tool, with both ships known there, the target pricier than the base and
 *     its standard edition on sale (`standardSku`); its price is the msrp difference.
 * - **Same price or less**: the pledge's value (the store credit melting frees) is at least that
 *   price. Below it, the difference is the discount given up: a paint's within the tolerance of a
 *   volume discount tier (`PAINT_DISCOUNT_TIERS`) is a volume discount, which is off for a start
 *   (#528: rebought alone, it costs the full price).
 * - **Same insurance or better**: the store item of a ship has to name an insurance at least as
 *   good as the pledge's (`isAtLeast`, an LTI ship only with an LTI item). The store's items carry
 *   no insurance of their own: only some name it ("Starlite - 10 Year"), so a ship counts only
 *   where the name tells it ("not known" otherwise). A CCU that brings an insurance drops out: a
 *   CCU of the upgrade tool brings none that the extension knows of.
 * - **Still available in a few days**: no price increase ahead (confirmed or expected, as matched
 *   for the pledge's rows, `priceIncrease` and `ccuPriceChange`), no removal of the ship or a
 *   CCU's base or target ahead, the ship or the CCU's target always available (the ships' facts,
 *   #293).
 *
 * Unknown data – the store not read yet, a ship the upgrade tool or the facts don't know – count
 * as not rebuyable, with the reason `unknown`.
 */

/** What isn't known, for the reason `unknown`. */
export type RebuyUnknown = 'price' | 'onSale' | 'insurance' | 'availability';

/** Why a pledge can't be rebought without loss; several at once, in this order. */
export type RebuyReason =
  /** Protected game access (#416): RSI doesn't melt it. */
  | { code: 'protected' }
  /** A reward ($0, `rewards.ts`): nothing to melt. */
  | { code: 'reward' }
  /** RSI doesn't offer the exchange. */
  | { code: 'notMeltable' }
  /** Bought less than 24 hours ago: meltable at `meltableAt` (ms). */
  | { code: 'tooRecent'; meltableAt: number }
  | { code: 'giftable' }
  /** Paid with money and still refundable until `until` (ISO date); melting ends that. */
  | { code: 'refundPeriod'; daysLeft: number; until: string }
  /** A package with game access. */
  | { code: 'package' }
  /** Two ships or more. */
  | { code: 'pack' }
  | { code: 'upgraded' }
  /** More than the ship, the paint or the CCU's target (gear, paints, game access, …). */
  | { code: 'extraItems' }
  /** No paint, ship or CCU (gear, add-ons, flair, …). */
  | { code: 'otherKind' }
  | { code: 'notOnSale' }
  /** A warbond or sale price: rebought, it costs `price`, `amount` more than its value. */
  | { code: 'discount'; amount: number; percent: number; price: number }
  /** A paint's volume discount (`percent` is the tier): rebought alone, it costs `price`. */
  | { code: 'paintVolumeDiscount'; amount: number; percent: number; price: number }
  /** The store doesn't offer the pledge's `insurance`; `offered` the best it has, if any. */
  | { code: 'insurance'; insurance: Insurance; offered?: Insurance }
  /** The price of `ship` rises at `at` (ms), `confirmed` by CIG or only expected (#275). */
  | { code: 'priceIncrease'; ship: string; at: number; confirmed: boolean }
  /** `ship` leaves the Pledge Store (#285). */
  | { code: 'removal'; ship: string; removedAt: DayOrTime }
  /** `ship` is on sale only now and then, e.g. in an event (#293). */
  | { code: 'notAlwaysAvailable'; ship: string }
  | { code: 'unknown'; missing: RebuyUnknown };

export type RebuyReasonCode = RebuyReason['code'];

/** What a pledge is rebought as: the store item, in the form of a watchlist's item ref (#470). */
export type RebuyItem =
  | { kind: 'storePaint'; skuId: number; name: string; price: number }
  | {
      kind: 'storeShip';
      /** The upgrade tool's ship id. */
      shipId: number;
      /** The insurance the store item names; none while it names none. */
      insurance?: WatchInsurance;
      /** The store item (SKU). */
      skuId: number;
      name: string;
      price: number;
    }
  | {
      kind: 'storeCcu';
      fromShipId: number;
      toShipId: number;
      fromName: string;
      toName: string;
      price: number;
    };

/** Whether and how a pledge can be melted and rebought. */
export interface Rebuy {
  pledgeId: number;
  /** No reason against it. */
  rebuyable: boolean;
  reasons: RebuyReason[];
  /** The store credit melting frees: the pledge's value in USD. */
  freedCredit: number;
  /** What rebuying it costs in store credit now (standard price), if known. */
  rebuyPrice?: number;
  /** The store item it is rebought as, if found (also when it isn't rebuyable). */
  item?: RebuyItem;
}

/** The fields of a pledge of My Hangar the rules read. */
export type RebuyPledge = Pick<
  PledgeView,
  | 'id'
  | 'title'
  | 'valueUsd'
  | 'createdAt'
  | 'order'
  | 'reward'
  | 'insurance'
  | 'isPaint'
  | 'isCcu'
  | 'hasGameAccess'
  | 'isGamePackage'
  | 'protectedGames'
  | 'isGiftable'
  | 'isMeltable'
  | 'isUpgraded'
  | 'items'
  | 'upgrade'
  | 'priceIncrease'
  | 'ccuPriceChange'
>;

/** What the rules know besides the pledges. */
export interface RebuyContext {
  /** The Pledge Store: upgrade tool ships, ships on sale, warbonds, store items. */
  catalog: StoreCatalog;
  /** Whether a ship (the upgrade tool's id) is always available; `undefined` if not known. */
  alwaysAvailable: (shipId: number) => boolean | undefined;
  /** The upcoming ship removals, by the upgrade tool's ship id. */
  removals: ReadonlyMap<number, ShipRemoval>;
  /** When each pledge was bought (see `hangarPurchases`). */
  purchases: ReadonlyMap<number, Purchase>;
  /** Now in ms. */
  now: number;
  /** Today as ISO date (local), for the refund period. */
  today: string;
}

const CENT = 0.005;
const round = (value: number) => Math.round(value * 100) / 100;

const STANDALONE = /^standalone ships?$/i;

/** "LTI", "Lifetime Insurance", "10 Year", "6 Month Insurance" → the insurance; else none. */
export function insuranceOfName(suffix: string): Insurance | undefined {
  const text = suffix.trim();
  if (/^(?:lti|lifetime(?:\s+insurance)?)$/i.test(text)) return { lifetime: true };
  const match = /^(\d+)[\s-]*(year|month)s?(?:\s+insurance)?$/i.exec(text);
  if (!match) return parseInsurance(text);
  const count = Number(match[1]);
  return { lifetime: false, months: /year/i.test(match[2]!) ? count * 12 : count };
}

/** A store item's name split into what it sells and the insurance named after it. */
function splitInsurance(name: string): { base: string; insurance?: Insurance } {
  const at = name.search(/\s+[-–]\s+[^-–]+$/);
  if (at > 0) {
    const insurance = insuranceOfName(name.slice(at).replace(/^\s+[-–]\s+/, ''));
    if (insurance) return { base: name.slice(0, at), insurance };
  }
  return { base: name };
}

const toWatchInsurance = (insurance: Insurance | undefined): WatchInsurance | undefined =>
  insurance && (insurance.lifetime ? 'lti' : insurance.months);

/** Whether a paint's discount of `percent` is one of RSI's volume discount tiers. */
const isPaintTier = (percent: number) =>
  PAINT_DISCOUNT_TIERS.tiers.some((tier) => tier.percent === roundToPaintTier(percent));

/** Works out `Rebuy` for pledges; build it once per list. */
export function createRebuyJudge(context: RebuyContext) {
  const { catalog } = context;
  const ships = catalog.ships;
  const lookup = ships?.length ? createShipLookup(ships) : undefined;
  const items = catalog.items;
  const buyable = catalog.buyable;

  // The store items a pledge can be rebought as with store credit: in stock, no warbond item.
  const offers = (items ?? []).filter((item) => item.available && !item.isWarbond);
  const offersByName = new Map<string, StoreItem[]>();
  for (const item of offers) {
    const key = storeNameOf(item.name);
    offersByName.set(key, [...(offersByName.get(key) ?? []), item]);
  }

  // The standalone ships of the store by the ship they sell: its upgrade tool id, else its name.
  interface ShipOffer {
    item: StoreItem;
    insurance?: Insurance;
  }
  const shipOffersById = new Map<number, ShipOffer[]>();
  const shipOffersByName = new Map<string, ShipOffer[]>();
  for (const item of offers) {
    if (!STANDALONE.test(item.category)) continue;
    const { base, insurance } = splitInsurance(item.name);
    const offer = { item, ...(insurance && { insurance }) };
    const id = lookup?.shipOf(base)?.id;
    if (id !== undefined) shipOffersById.set(id, [...(shipOffersById.get(id) ?? []), offer]);
    const key = nameKey(base);
    shipOffersByName.set(key, [...(shipOffersByName.get(key) ?? []), offer]);
  }

  const shipOf = (name: string | undefined): Ship | undefined =>
    name ? lookup?.shipOf(name) : undefined;

  return (pledge: RebuyPledge): Rebuy => {
    const reasons: RebuyReason[] = [];
    const add = (reason: RebuyReason) => reasons.push(reason);
    const value = pledge.valueUsd;
    let rebuyPrice: number | undefined;
    let item: RebuyItem | undefined;

    // Meltable now.
    const isProtected = pledge.protectedGames.length > 0;
    const purchase = context.purchases.get(pledge.id);
    const meltAt = meltableAt({
      boughtAt: purchase?.at,
      boughtOn: purchase?.on ?? pledge.createdAt,
      markedAt: context.now,
    });
    const tooRecent = meltAt > context.now;
    if (isProtected) add({ code: 'protected' });
    else if (pledge.reward) add({ code: 'reward' });
    else if (!pledge.isMeltable && !tooRecent) add({ code: 'notMeltable' });
    if (tooRecent && !isProtected && !pledge.reward) add({ code: 'tooRecent', meltableAt: meltAt });

    if (pledge.isGiftable) add({ code: 'giftable' });
    const refund = pledge.order?.placedAt && refundWindow(pledge.order.placedAt, context.today);
    if (refund) add({ code: 'refundPeriod', daysLeft: refund.daysLeft, until: refund.until });

    // One plain item.
    type Plain = 'paint' | 'ship' | 'ccu';
    let plain: Plain | undefined;
    if (pledge.isUpgraded) add({ code: 'upgraded' });
    if (pledge.hasGameAccess || pledge.isGamePackage) add({ code: 'package' });
    if (!pledge.isUpgraded && !pledge.hasGameAccess && !pledge.isGamePackage) {
      if (pledge.isCcu) {
        if (hangarCcuContents(pledge.upgrade) === 'extras') add({ code: 'extraItems' });
        else plain = 'ccu';
      } else if (pledge.isPaint) {
        if (pledge.items.length === 1) plain = 'paint';
        else add({ code: 'extraItems' });
      } else {
        const kind = pledgeShipKind(pledge.items);
        if (kind === 'solo') plain = 'ship';
        else if (kind === 'extras') add({ code: 'extraItems' });
        else if (kind === 'pack') add({ code: 'pack' });
        else add({ code: 'otherKind' });
      }
    }

    /** The price compared with the value: the discount given up, if any. */
    const comparePrice = (price: number, paint = false) => {
      rebuyPrice = price;
      const amount = round(price - value);
      if (amount <= CENT) return;
      const percent = (amount / price) * 100;
      if (paint && isPaintTier(percent)) {
        add({ code: 'paintVolumeDiscount', amount, percent: roundToPaintTier(percent), price });
      } else {
        add({ code: 'discount', amount, percent, price });
      }
    };
    const increase = (found: ExpectedPriceIncrease | undefined, seen: Set<number>) => {
      if (!found || seen.has(found.ship.id)) return;
      seen.add(found.ship.id);
      add({
        code: 'priceIncrease',
        ship: found.ship.name,
        at: found.priceIncreaseAt.at,
        confirmed: found.confirmed === true,
      });
    };
    const removal = (ship: Ship) => {
      const found = context.removals.get(ship.id);
      if (found) add({ code: 'removal', ship: ship.name, removedAt: found.removedAt });
    };
    const alwaysAvailable = (ship: Ship) => {
      const available = context.alwaysAvailable(ship.id);
      if (available === false) add({ code: 'notAlwaysAvailable', ship: ship.name });
      else if (available === undefined) add({ code: 'unknown', missing: 'availability' });
    };

    if (plain === 'paint') {
      const paint = pledge.items[0]!;
      const keys = [storeNameOf(pledge.title), storeNameOf(paint.title)];
      const found = keys.flatMap((key) => offersByName.get(key) ?? []);
      if (!items) add({ code: 'unknown', missing: 'price' });
      else if (!found.length) add({ code: 'notOnSale' });
      else {
        // Several of one name: the standard one costs the most (see `item-prices.ts`).
        const offer = found.reduce((best, next) => (next.price > best.price ? next : best));
        item = { kind: 'storePaint', skuId: offer.id, name: offer.name, price: offer.price };
        comparePrice(offer.price, true);
      }
    }

    if (plain === 'ship') {
      const shipItem = pledge.items.find((entry) => entry.kind === 'Ship')!;
      const ship = shipOf(shipItem.title);
      if (!items) add({ code: 'unknown', missing: 'price' });
      else {
        const own = offersByName.get(storeNameOf(pledge.title)) ?? [];
        const candidates = new Map<number, ShipOffer>();
        for (const offer of own.filter((entry) => STANDALONE.test(entry.category))) {
          const insurance = splitInsurance(offer.name).insurance;
          candidates.set(offer.id, { item: offer, ...(insurance && { insurance }) });
        }
        const byShip = ship
          ? shipOffersById.get(ship.id)
          : shipOffersByName.get(nameKey(shipItem.title));
        for (const offer of byShip ?? []) candidates.set(offer.item.id, offer);
        const list = [...candidates.values()];
        const needed = pledge.insurance;
        const cheapest = (entries: ShipOffer[]) =>
          entries.reduce<ShipOffer | undefined>(
            (best, next) => (!best || next.item.price < best.item.price ? next : best),
            undefined,
          );
        const covering = list.filter(
          (offer) => !needed || (offer.insurance && isAtLeast(offer.insurance, needed)),
        );
        const unknownInsurance = list.filter((offer) => !offer.insurance);
        let chosen: ShipOffer | undefined;
        if (!list.length) add({ code: 'notOnSale' });
        else if (covering.length) chosen = cheapest(covering);
        else if (unknownInsurance.length) {
          chosen = cheapest(unknownInsurance);
          add({ code: 'unknown', missing: 'insurance' });
        } else {
          chosen = cheapest(list);
          const offered = list
            .map((offer) => offer.insurance!)
            .reduce((best, next) => (isAtLeast(next, best) ? next : best));
          add({ code: 'insurance', insurance: needed!, offered });
        }
        if (chosen) {
          const insurance = toWatchInsurance(chosen.insurance);
          if (ship) {
            item = {
              kind: 'storeShip',
              shipId: ship.id,
              ...(insurance !== undefined && { insurance }),
              skuId: chosen.item.id,
              name: chosen.item.name,
              price: chosen.item.price,
            };
          }
          comparePrice(chosen.item.price);
        }
      }
      increase(pledge.priceIncrease?.increase, new Set());
      if (ship) {
        removal(ship);
        alwaysAvailable(ship);
      } else {
        // Without the upgrade tool's ship neither the facts nor the removals are known.
        add({ code: 'unknown', missing: 'availability' });
      }
    }

    if (plain === 'ccu') {
      const names = ccuShips(pledge.title);
      const from = shipOf(pledge.upgrade?.matchItems[0]?.name ?? names?.from);
      const to = shipOf(pledge.upgrade?.targetItems[0]?.name ?? names?.to);
      const seen = new Set<number>();
      if (!from || !to || !(from.msrp > 0) || !(to.msrp > 0)) {
        add({ code: 'unknown', missing: 'price' });
      } else {
        const price = round(to.msrp - from.msrp);
        if (price <= 0) add({ code: 'notOnSale' });
        else if (!buyable) add({ code: 'unknown', missing: 'onSale' });
        else if (!standardSku({ buyable, warbonds: catalog.warbonds ?? [] }, to.id)) {
          add({ code: 'notOnSale' });
        }
        if (price > 0) {
          item = {
            kind: 'storeCcu',
            fromShipId: from.id,
            toShipId: to.id,
            fromName: from.name,
            toName: to.name,
            price,
          };
          comparePrice(price);
        }
      }
      // A CCU that brings an insurance: one of the upgrade tool doesn't.
      if (pledge.insurance) add({ code: 'insurance', insurance: pledge.insurance });
      increase(pledge.ccuPriceChange?.base, seen);
      increase(pledge.ccuPriceChange?.target, seen);
      increase(pledge.priceIncrease?.increase, seen);
      if (from && to) {
        removal(from);
        removal(to);
        alwaysAvailable(to);
      }
    }

    return {
      pledgeId: pledge.id,
      rebuyable: reasons.length === 0,
      reasons,
      freedCredit: value,
      ...(rebuyPrice !== undefined && { rebuyPrice }),
      ...(item && { item }),
    };
  };
}

/** `Rebuy` of every pledge, by its id. */
export function rebuyables(
  pledges: readonly RebuyPledge[],
  context: RebuyContext,
): Map<number, Rebuy> {
  const judge = createRebuyJudge(context);
  return new Map(pledges.map((pledge) => [pledge.id, judge(pledge)]));
}

/** The store credit the given rebuyable pledges free together. */
export const freedCreditOf = (entries: Iterable<Rebuy>): number => {
  let sum = 0;
  for (const entry of entries) if (entry.rebuyable) sum += entry.freedCredit;
  return round(sum);
};

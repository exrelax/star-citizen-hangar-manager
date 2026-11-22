import { itemKey, type WatchItemRef } from '@/watchlists/watchlists';
import type { Rebuy, RebuyItem } from './rebuyable';

/*
 * Pledges on a watchlist to rebuy them (#531): each rebuyable pledge (#528) goes on it as the store
 * item it is rebought as – the paint, the standalone ship with its insurance, the CCU from → to –,
 * not as the hangar pledge that is melted soon. Several pledges of one item add up to its count.
 * Pledges that can't be rebought without loss stay off; they are counted.
 */

/** A store item to put on a watchlist with its count: its price now as its value. */
export type RebuyWatchItem = WatchItemRef & { name: string; value: number; count: number };

export interface RebuyWatchPlan {
  /** The store items, each once, in the order of their first pledge. */
  items: RebuyWatchItem[];
  /** The rebuyable pledges among the given ones, e.g. to mark them to melt. */
  pledgeIds: number[];
  /** The given pledges left off: not rebuyable, or not known as such. */
  skipped: number;
  /** What rebuying them all costs in store credit now, in USD. */
  total: number;
  /** The store credit melting them frees, in USD. */
  freedCredit: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The ref and name of the store item a pledge is rebought as. */
function watchItemOf(item: RebuyItem, ccuName: (from: string, to: string) => string) {
  switch (item.kind) {
    case 'storePaint':
      return { ref: { kind: item.kind, skuId: item.skuId }, name: item.name };
    case 'storeShip':
      return {
        ref: {
          kind: item.kind,
          shipId: item.shipId,
          ...(item.insurance !== undefined && { insurance: item.insurance }),
        },
        name: item.name,
      };
    case 'storeCcu':
      return {
        ref: { kind: item.kind, fromShipId: item.fromShipId, toShipId: item.toShipId },
        name: ccuName(item.fromName, item.toName),
      };
  }
}

/**
 * The watchlist items of the given pledges (`rebuys` by pledge id, see `useProvidedRebuyables`);
 * none while not one of them can be rebought. `ccuName` names a CCU as the watchlists do.
 */
export function rebuyWatchPlan(
  pledgeIds: Iterable<number>,
  rebuys: ReadonlyMap<number, Rebuy>,
  ccuName: (from: string, to: string) => string,
): RebuyWatchPlan | undefined {
  const byKey = new Map<string, RebuyWatchItem>();
  const plan: RebuyWatchPlan = { items: [], pledgeIds: [], skipped: 0, total: 0, freedCredit: 0 };
  for (const id of pledgeIds) {
    const rebuy = rebuys.get(id);
    if (!rebuy?.rebuyable || !rebuy.item) {
      plan.skipped += 1;
      continue;
    }
    const { ref, name } = watchItemOf(rebuy.item, ccuName);
    const key = itemKey(ref as WatchItemRef);
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else {
      const entry = { ...ref, name, value: rebuy.item.price, count: 1 } as RebuyWatchItem;
      byKey.set(key, entry);
      plan.items.push(entry);
    }
    plan.pledgeIds.push(id);
    // A paint bought at a volume discount at its tier's price (#593), as the note tells.
    plan.total += rebuy.rebuyPrice ?? rebuy.item.price;
    plan.freedCredit += rebuy.freedCredit;
  }
  if (!plan.pledgeIds.length) return undefined;
  plan.total = round(plan.total);
  plan.freedCredit = round(plan.freedCredit);
  return plan;
}

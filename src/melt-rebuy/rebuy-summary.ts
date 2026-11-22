import { freedCreditOf, type Rebuy } from './rebuyable';

/*
 * Melt and Rebuy in My Hangar (#530): which of some pledges are rebuyable, for the List Shortcut
 * "Melt and rebuy" (its rule and its bar), the label of a group and the "Selected" box.
 */

/** Whether the pledge can be melted now and rebought later without loss (#528). */
export const isRebuyable = (rebuys: ReadonlyMap<number, Rebuy>, pledgeId: number): boolean =>
  rebuys.get(pledgeId)?.rebuyable === true;

export interface RebuySummary {
  /** The rebuyable pledges among them. */
  count: number;
  /** The store credit melting them frees together. */
  freedCredit: number;
  /** What rebuying them costs in store credit now (standard prices). */
  rebuyPrice: number;
}

/** The rebuyable ones of the given pledges, by their ids: how many, what they free and cost. */
export function rebuySummary(
  rebuys: ReadonlyMap<number, Rebuy>,
  pledgeIds: Iterable<number>,
): RebuySummary {
  const entries: Rebuy[] = [];
  for (const id of pledgeIds) {
    const entry = rebuys.get(id);
    if (entry?.rebuyable) entries.push(entry);
  }
  const price = entries.reduce((sum, entry) => sum + (entry.rebuyPrice ?? 0), 0);
  return {
    count: entries.length,
    freedCredit: freedCreditOf(entries),
    rebuyPrice: Math.round(price * 100) / 100,
  };
}

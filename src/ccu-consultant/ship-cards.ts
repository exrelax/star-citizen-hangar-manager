import type { BaseShipGroup, BaseShipList, BaseShipRow } from './base-ship-list';
import type { CoverageMatch } from './coverage';

/*
 * The simple view of the CCU Consultant (#563): a card per base ship of the chosen group, with
 * its image and price, how many CCUs start from it, whether RSI sells it now, the pledges that lead
 * to it (ships and CCUs to it in the hangar or the buy back) as thumbnails, and one action – the
 * one its row of the tables offers: the buy back's pledges, RSI's ship upgrade dialog, the ship in
 * the Ship Removals or its page in the Pledge Store.
 */

/** The parts of a group: the group "Without base ship" also lists those short of ways (#454). */
export type CardSection = BaseShipGroup | 'soon' | 'tooFew';

export interface CardThumb {
  id: number;
  title: string;
  image?: string;
}

export type CardAction =
  /** The buy back's ships and CCUs to it, opened as a List Shortcut. */
  | { kind: 'buyback'; ids: number[] }
  /** RSI's ship upgrade dialog with it as target, by its standard SKU. */
  | { kind: 'upgrade'; skuId: number }
  /** It in the Ship Removals of the Pledge Store tab (#454). */
  | { kind: 'removal'; shipId: number }
  /** Its page in the Pledge Store. */
  | { kind: 'store'; link: string };

export interface ShipCard {
  row: BaseShipRow;
  section: CardSection;
  image?: string;
  /** RSI sells it now: its standard SKU is on sale. */
  onSale: boolean;
  /** The pledges that lead to it, as thumbnails (the hangar's first). */
  thumbs: CardThumb[];
  /** Of them: ships and CCUs. */
  ships: number;
  ccus: number;
  action?: CardAction;
}

export interface CardSources {
  /** The base ship's image, by the upgrade tool's ship id. */
  imageOf: (shipId: number) => string | undefined;
  /** Its standard SKU while on sale (`standardSku`). */
  skuOf: (row: BaseShipRow) => number | undefined;
  /** The image of a pledge leading to it: a ship's own, a CCU's base ship. */
  thumbOf: (match: CoverageMatch) => string | undefined;
}

/** The sections of a group, each with its base ships; empty ones only for the group itself. */
export function cardSections(
  list: BaseShipList,
  group: BaseShipGroup,
): { section: CardSection; rows: BaseShipRow[] }[] {
  const own = { section: group, rows: list.groups[group] };
  if (group !== 'missing') return [own];
  return [
    own,
    ...[
      { section: 'soon' as const, rows: list.soon },
      { section: 'tooFew' as const, rows: list.tooFew },
    ].filter((part) => part.rows.length),
  ];
}

/** Every CCU of a group's base ships, once each (for "Show N CCUs in My Hangar"). */
export function groupCcuIds(list: BaseShipList, group: BaseShipGroup): number[] {
  return [
    ...new Set(cardSections(list, group).flatMap((part) => part.rows.flatMap((row) => row.ccus))),
  ];
}

function actionOf(
  row: BaseShipRow,
  section: CardSection,
  skuId: number | undefined,
): CardAction | undefined {
  const store = row.link ? ({ kind: 'store', link: row.link } as const) : undefined;
  if (section === 'buyback') {
    return row.matches.length
      ? { kind: 'buyback', ids: row.matches.map((match) => match.id) }
      : undefined;
  }
  if (section === 'missing') return store;
  if (skuId !== undefined) return { kind: 'upgrade', skuId };
  if (section !== 'always' && row.removal && row.shipId !== undefined) {
    return { kind: 'removal', shipId: row.shipId };
  }
  return store;
}

/** The cards of a section's base ships, in their order. */
export function shipCards(
  rows: readonly BaseShipRow[],
  section: CardSection,
  sources: CardSources,
): ShipCard[] {
  return rows.map((row) => {
    const skuId = sources.skuOf(row);
    const image = row.shipId !== undefined ? sources.imageOf(row.shipId) : undefined;
    const thumbs = row.matches.map((match): CardThumb => {
      const thumb = sources.thumbOf(match);
      return { id: match.id, title: match.title, ...(thumb && { image: thumb }) };
    });
    const action = actionOf(row, section, skuId);
    return {
      row,
      section,
      ...(image && { image }),
      onSale: skuId !== undefined,
      thumbs,
      ships: row.matches.filter((match) => match.kind === 'ship').length,
      ccus: row.matches.filter((match) => match.kind === 'ccu').length,
      ...(action && { action }),
    };
  });
}

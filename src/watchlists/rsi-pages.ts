import { splitInsurance, STANDALONE } from '@/melt-rebuy/rebuyable';
import type { Ship } from '@/ships/ships';
import type { StoreItem } from '@/store/items/store-items';
import type { createShipLookup } from '@/store/warbond';
import type { WatchInsurance } from './watchlists';

/*
 * Where RSI's own pages offer a Pledge Store item to put on a watchlist (#471), read from their
 * markup (November 2026):
 *
 * - A paint's page, e.g. "/en/pledge/Paint/Marauder-Bloodlet-Paint": its buying block
 *   `.m-storeAction__wrapper` with RSI's "Add to cart". The page names no SKU: the paint is the
 *   store item whose link is the page's path, else whose name the title tells ("Buy <name> -
 *   Paints | …").
 * - RSI's ship upgrade dialog (`.ShipUpgradeModal`) once a base and a target ship are chosen: each
 *   side (`.ShipSelector.from`, `.ShipSelector.to`) then holds one `.ShipItem`, whose
 *   `data-store-action-label` names RSI's ship id ("Select P-52 Merlin (id: 92) as from ship"),
 *   and `.AddToCart` holds the price and, in `.AddToCart-cta-wrapper`, RSI's "Add To Cart".
 * - The store's lists, e.g. "/en/store/pledge/browse/paints" (#632): each item is a card
 *   `.c-skuCard` whose link `.c-skuCard__anchor` is the path of the item's page, with RSI's cart
 *   button in `.c-skuCard__actions`. A card of a paint is a store item by that path; a card of a
 *   standalone ship ("/en/store/pledge/browse/extras/standalone-ships") is the upgrade tool's ship
 *   its store item names, with the insurance it names ("Avenger Titan - 10 Year").
 */

/** Where a button sits: a paint's page, a card of the store's lists, the ship upgrade dialog. */
export type RsiWatchPlace = 'page' | 'card' | 'dialog';

/** A path without RSI's locale prefix, in lower case: "/pledge/paint/marauder-bloodlet-paint". */
export const storePath = (path: string): string =>
  path
    .replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '')
    .replace(/\/+$/, '')
    .toLowerCase();

/** Whether the path is a paint's page of the Pledge Store. */
export const isPaintPage = (path: string): boolean =>
  /^\/pledge\/paints?\/[^/]+$/.test(storePath(path));

/** The paint a page shows: by its path, else by its title. */
export function paintOfPage(
  path: string,
  title: string,
  items: readonly StoreItem[],
): StoreItem | undefined {
  const paints = items.filter((item) => item.category === 'Paints');
  const here = storePath(path);
  const byLink = paints.find((item) => item.link && storePath(item.link) === here);
  if (byLink) return byLink;
  const name = /^Buy (.+?) - Paints\b/.exec(title.trim())?.[1]?.trim().toLowerCase();
  return name ? paints.find((item) => item.name.trim().toLowerCase() === name) : undefined;
}

/** A link's path without host, query and hash. */
const pathOf = (href: string) => href.replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '');

/** The store item a link of the store's lists goes to. */
const itemOfLink = (href: string, items: readonly StoreItem[]) => {
  const here = storePath(pathOf(href));
  return items.find((item) => item.link && storePath(item.link) === here);
};

/** The paint of a card of the store's lists, by the path its link goes to. */
export function paintOfCard(href: string, items: readonly StoreItem[]): StoreItem | undefined {
  if (!isPaintPage(pathOf(href))) return undefined;
  const item = itemOfLink(href, items);
  return item?.category === 'Paints' ? item : undefined;
}

export interface CardShip {
  /** The store item of the card, e.g. "Avenger Titan - 10 Year". */
  item: StoreItem;
  /** The upgrade tool's ship it is. */
  ship: Ship;
  /** The insurance its name tells, if any. */
  insurance?: WatchInsurance;
}

/**
 * The standalone ship of a card of the store's lists (#632): its store item by the link, the ship
 * by the name without the insurance or edition after " - " ("Perseus - Best in Show 2956
 * Edition"). `lookup` from `createShipLookup`, built once for the ships.
 */
export function shipOfCard(
  href: string,
  items: readonly StoreItem[],
  lookup: ReturnType<typeof createShipLookup>,
): CardShip | undefined {
  const item = itemOfLink(href, items);
  if (!item || !STANDALONE.test(item.category)) return undefined;
  const { base, insurance } = splitInsurance(item.name);
  const ship = lookup.shipOf(base) ?? lookup.shipOf(base.replace(/\s+[-–]\s+[^-–]+$/, ''));
  if (!ship) return undefined;
  const watched = insurance && (insurance.lifetime ? 'lti' : insurance.months);
  return { item, ship, ...(watched && { insurance: watched }) };
}

export const PAINT_ANCHOR = '.m-storeAction__wrapper';
export const SKU_CARD = '.c-skuCard';
export const SKU_CARD_LINK = '.c-skuCard__anchor';
export const SKU_CARD_ACTIONS = '.c-skuCard__actions';
export const UPGRADE_MODAL = '.ShipUpgradeModal';
export const UPGRADE_CART = '.AddToCart .AddToCart-cta-wrapper';
const SIDES = { from: '.ShipSelector.from', to: '.ShipSelector.to' } as const;
const ITEM = '.ShipItem';
const NAME = '.ShipItem-general-information-name';

export interface ChosenShip {
  id: number;
  name: string;
}

/** The ship chosen on one side of the dialog: its only item, with RSI's id and its name. */
function chosenOf(modal: ParentNode, side: keyof typeof SIDES): ChosenShip | undefined {
  const items = modal.querySelectorAll(`${SIDES[side]} ${ITEM}`);
  if (items.length !== 1) return undefined;
  const item = items[0]!;
  const label = item.getAttribute('data-store-action-label') ?? '';
  const id = /\(id:\s*(\d+)\)/.exec(label)?.[1];
  const name = item.querySelector(NAME)?.textContent?.trim();
  return id && name ? { id: Number(id), name } : undefined;
}

/** The CCU the dialog offers now: both ships chosen; none while one is still to choose. */
export function chosenUpgrade(modal: ParentNode): { from: ChosenShip; to: ChosenShip } | undefined {
  const from = chosenOf(modal, 'from');
  const to = chosenOf(modal, 'to');
  return from && to && from.id !== to.id ? { from, to } : undefined;
}

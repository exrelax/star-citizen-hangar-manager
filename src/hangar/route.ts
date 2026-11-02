import { BUYBACK_PAGE_SIZE, HIGHLIGHT_URL_PARAM, SEARCH_URL_PARAM } from '@/config';

/** URL fragment that switches the original hangar page to the manager view. */
export const MANAGER_HASH = '#hangar-manager';

// "/account/pledges", optionally with a locale prefix such as "/en" or "/de-de".
const HANGAR_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?account\/pledges\/?$/i;

/** Whether the path is the original hangar page, which hosts the manager view. */
export function isHangarPath(pathname: string): boolean {
  return HANGAR_PATH.test(pathname);
}

/**
 * Opens a tab of the manager view searching for a pledge id (works from other sites, e.g.
 * CCU Game).
 */
export function managerSearchUrl(pledgeId: number, tab: ManagerTab = 'hangar'): string {
  return (
    `https://robertsspaceindustries.com/account/pledges?${SEARCH_URL_PARAM}=${pledgeId}` +
    hashOfTab(tab)
  );
}

/** Search term given in the page URL (see `SEARCH_URL_PARAM`), or an empty string. */
export function searchFromUrl(search: string): string {
  return new URLSearchParams(search).get(SEARCH_URL_PARAM)?.trim() ?? '';
}

/** The URL with the search term set (or removed when empty); everything else stays as it is. */
export function urlWithSearch(href: string, term: string): string {
  const url = new URL(href);
  if (term.trim()) url.searchParams.set(SEARCH_URL_PARAM, term.trim());
  else url.searchParams.delete(SEARCH_URL_PARAM);
  return url.href;
}

/** Link to a page of the original "My Gear" list that highlights the given pledge. */
export function myGearHref(pathname: string, page: number, pledgeId: number): string {
  return `${pathname}?page=${page}&${HIGHLIGHT_URL_PARAM}=${pledgeId}`;
}

/** Pledge id to highlight, from the page URL (see `HIGHLIGHT_URL_PARAM`). */
export function highlightFromUrl(search: string): number | undefined {
  const id = Number(new URLSearchParams(search).get(HIGHLIGHT_URL_PARAM));
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** The URL without the highlight parameter, so a reload doesn't highlight again. */
export function urlWithoutHighlight(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(HIGHLIGHT_URL_PARAM);
  return url.href;
}

/** Current page of the "My Gear" list from the page URL (RSI's `page` parameter). */
export function pageFromUrl(search: string): number {
  const page = Number(new URLSearchParams(search).get('page'));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Tabs of the manager view, each with its own hash as deep link. */
export const MANAGER_TABS = ['hangar', 'buyback', 'settings'] as const;
export type ManagerTab = (typeof MANAGER_TABS)[number];

const TAB_HASHES: Record<ManagerTab, string> = {
  hangar: MANAGER_HASH,
  buyback: `${MANAGER_HASH}-bb`,
  settings: `${MANAGER_HASH}-settings`,
};

export function tabFromHash(hash: string): ManagerTab | undefined {
  return MANAGER_TABS.find((tab) => TAB_HASHES[tab] === hash);
}

export function hashOfTab(tab: ManagerTab): string {
  return TAB_HASHES[tab];
}

/** Whether the hash opens the manager view (any of its tabs). */
export function isManagerRoute(hash: string): boolean {
  return tabFromHash(hash) !== undefined;
}

// "/account/buy-back-pledges", optionally with a locale prefix.
const BUYBACK_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?account\/buy-back-pledges\/?$/i;

/** Whether the path is RSI's original buy back list. */
export function isBuybackPath(pathname: string): boolean {
  return BUYBACK_PATH.test(pathname);
}

/**
 * Link to a page of RSI's buy back list that highlights the given pledge. `hangarPathname` is
 * the path of the manager's hangar page; its locale prefix is kept.
 */
export function buybackHref(
  hangarPathname: string,
  page: number,
  pledgeId: number,
  pageSize = BUYBACK_PAGE_SIZE,
): string {
  const pathname = hangarPathname.replace(/account\/pledges\/?$/, 'account/buy-back-pledges');
  return `${pathname}?page=${page}&pagesize=${pageSize}&${HIGHLIGHT_URL_PARAM}=${pledgeId}`;
}

/** RSI's `pagesize` parameter from the page URL, or `fallback`. */
export function pageSizeFromUrl(search: string, fallback: number): number {
  const size = Number(new URLSearchParams(search).get('pagesize'));
  return Number.isInteger(size) && size > 0 ? size : fallback;
}

/** Link to the manager view, derived from the site's own hangar link so its locale prefix is kept. */
export function managerHref(hangarHref: string): string {
  return hangarHref.split('#')[0] + MANAGER_HASH;
}

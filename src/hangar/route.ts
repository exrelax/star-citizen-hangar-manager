import { HIGHLIGHT_URL_PARAM, SEARCH_URL_PARAM } from '@/config';

/** URL fragment that switches the original hangar page to the manager view. */
export const MANAGER_HASH = '#hangar-manager';

// "/account/pledges", optionally with a locale prefix such as "/en" or "/de-de".
const HANGAR_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?account\/pledges\/?$/i;

/** Whether the path is the original hangar page, which hosts the manager view. */
export function isHangarPath(pathname: string): boolean {
  return HANGAR_PATH.test(pathname);
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

export function isManagerRoute(hash: string): boolean {
  return hash === MANAGER_HASH;
}

/** Link to the manager view, derived from the site's own hangar link so its locale prefix is kept. */
export function managerHref(hangarHref: string): string {
  return hangarHref.split('#')[0] + MANAGER_HASH;
}

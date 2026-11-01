import { SEARCH_URL_PARAM } from '@/config';

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

export function isManagerRoute(hash: string): boolean {
  return hash === MANAGER_HASH;
}

/** Link to the manager view, derived from the site's own hangar link so its locale prefix is kept. */
export function managerHref(hangarHref: string): string {
  return hangarHref.split('#')[0] + MANAGER_HASH;
}

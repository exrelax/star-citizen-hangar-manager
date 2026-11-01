/** URL fragment that switches the original hangar page to the manager view. */
export const MANAGER_HASH = '#hangar-manager';

// "/account/pledges", optionally with a locale prefix such as "/en" or "/de-de".
const HANGAR_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?account\/pledges\/?$/i;

/** Whether the path is the original hangar page, which hosts the manager view. */
export function isHangarPath(pathname: string): boolean {
  return HANGAR_PATH.test(pathname);
}

export function isManagerRoute(hash: string): boolean {
  return hash === MANAGER_HASH;
}

/** Link to the manager view, derived from the site's own hangar link so its locale prefix is kept. */
export function managerHref(hangarHref: string): string {
  return hangarHref.split('#')[0] + MANAGER_HASH;
}

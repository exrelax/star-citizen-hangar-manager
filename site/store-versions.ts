/*
 * The version each store has live, in smaller type below its button (#368): read while building,
 * from the public endpoints the store review uses (`scripts/store-review/stores.ts`). The site is
 * static, so the hourly store review starts a website build when a store lists another version
 * than the deployed site shows (`scripts/store-review/store-review.ts`).
 */

import { readListing, STORES } from '../scripts/store-review/stores.ts';

/** The stores with a button on the website. */
export const SITE_STORES = ['chrome', 'firefox'] as const;
export type SiteStore = (typeof SITE_STORES)[number];

export type StoreVersions = Partial<Record<SiteStore, string>>;

/** The placeholder below a store's button in index.html. */
export const storeVersionPlaceholder = (store: SiteStore) => `<!-- store-version:${store} -->`;

/**
 * The version each store lists. A store that can't be read, or doesn't list the extension, is left
 * out: its line is better missing than wrong, and the build goes on.
 */
export async function fetchStoreVersions(
  warn: (message: string) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<StoreVersions> {
  const entries = await Promise.all(
    SITE_STORES.map(async (store) => {
      try {
        const listing = await readListing(STORES[store], STORES[store].defaultId!, fetchImpl);
        if (!listing) warn(`${STORES[store].name} doesn't list the extension.`);
        return listing ? [[store, listing.version] as const] : [];
      } catch (error) {
        // The message names the store (`UnexpectedAnswer`).
        warn((error as Error).message);
        return [];
      }
    }),
  );
  return Object.fromEntries(entries.flat());
}

/** The line below a store's button, or nothing without a version. */
export const renderStoreVersion = (store: SiteStore, version: string | undefined): string =>
  version
    ? `<span class="install-version" data-store-version="${store}">Version ${version}</span>`
    : '';

/** Puts each store's version below its buttons. */
export const renderStoreVersions = (page: string, versions: StoreVersions): string =>
  SITE_STORES.reduce(
    (html, store) =>
      html.replaceAll(storeVersionPlaceholder(store), renderStoreVersion(store, versions[store])),
    page,
  );

/** The versions a page shows below the store buttons. */
export function shownStoreVersions(html: string): StoreVersions {
  const versions: StoreVersions = {};
  for (const match of html.matchAll(/data-store-version="(\w+)">Version ([\d.]+)</g)) {
    const store = match[1] as SiteStore;
    if (SITE_STORES.includes(store)) versions[store] = match[2];
  }
  return versions;
}

/**
 * The stores whose version the deployed site shows wrongly, e.g. "Chrome Web Store lists 1.1.1,
 * the website 1.1.0". Only lines the site shows count: a store that couldn't be read during the
 * build waits for the next one.
 */
export function outdatedStoreVersions(shown: StoreVersions, live: StoreVersions): string[] {
  return SITE_STORES.filter(
    (store) => shown[store] && live[store] && shown[store] !== live[store],
  ).map((store) => `${STORES[store].name} lists ${live[store]}, the website ${shown[store]}`);
}

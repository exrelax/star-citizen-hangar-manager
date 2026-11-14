/*
 * The version each browser store lists for the Hangar Manager (#350), read from public endpoints
 * without signing in, for the store review workflow (`store-review.ts`):
 * - Chrome Web Store: the update check Chrome itself uses, XML with `version="…"`; it also tells
 *   whether Enhanced Safe Browsing trusts the extension (`_esbAllowlist`, #333).
 * - Firefox Add-ons: the add-on API, JSON with `current_version.version`.
 * - Opera Add-ons: no API, so the listing page, whose "Version" row gives it; 404 until approved.
 * - Microsoft Edge Add-ons: the JSON the store's own pages use (not documented), with `version`;
 *   404 until listed. Edge gives the extension an id of its own, so its issue names it (`Id:`).
 * An answer that is neither a listing nor "not listed" throws: a store changed its endpoint, and
 * nothing may move on a guess.
 */

export const STORE_IDS = ['chrome', 'firefox', 'opera', 'edge'] as const;
export type StoreId = (typeof STORE_IDS)[number];

export interface Store {
  name: string;
  /** The extension's id or slug in the store; Edge's is known only once it is listed. */
  defaultId?: string;
  /** Where the version is read. */
  url: (id: string) => string;
  /** The listing in a browser, for the comments. */
  listingUrl: (id: string) => string;
  /** The version from the answer, `undefined` when the store doesn't list the extension. */
  parse: (status: number, body: string) => Listing | undefined;
}

export interface Listing {
  version: string;
  /** Chrome only: whether Enhanced Safe Browsing trusts the extension (#333). */
  esbTrusted?: boolean;
}

export class UnexpectedAnswer extends Error {
  constructor(store: string, detail: string) {
    super(`${store}: unexpected answer (${detail})`);
    this.name = 'UnexpectedAnswer';
  }
}

const VERSION = /^\d+(?:\.\d+){0,3}$/;

const checkedVersion = (store: string, version: unknown): string => {
  if (typeof version !== 'string' || !VERSION.test(version)) {
    throw new UnexpectedAnswer(store, `version ${JSON.stringify(version)}`);
  }
  return version;
};

const json = (store: string, body: string): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(body);
    if (value && typeof value === 'object') return value as Record<string, unknown>;
  } catch {
    // Reported below.
  }
  throw new UnexpectedAnswer(store, 'no JSON object');
};

/** The value of an XML attribute of the `<app>`'s `<updatecheck>`. */
const attribute = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

export const STORES: Record<StoreId, Store> = {
  chrome: {
    name: 'Chrome Web Store',
    defaultId: 'nofhjnkljndooegpllppamacogkikdjg',
    url: (id) =>
      `https://clients2.google.com/service/update2/crx?response=updatecheck&acceptformat=crx3&prodversion=150.0&x=id%3D${id}%26uc`,
    listingUrl: (id) => `https://chromewebstore.google.com/detail/${id}`,
    parse: (status, body) => {
      const name = 'Chrome Web Store';
      if (status !== 200) throw new UnexpectedAnswer(name, `HTTP ${status}`);
      const app = /<app\s[^>]*>/.exec(body)?.[0];
      if (!app) throw new UnexpectedAnswer(name, 'no <app>');
      const appStatus = attribute(app, 'status');
      if (appStatus === 'error-unknownApplication') return undefined;
      const check = /<updatecheck\s[^>]*>/.exec(body)?.[0];
      if (appStatus !== 'ok' || !check) {
        throw new UnexpectedAnswer(name, `status ${appStatus ?? 'missing'}`);
      }
      // "noupdate" would be the answer to an installed version; this check asks without one.
      if (attribute(check, 'status') !== 'ok') {
        throw new UnexpectedAnswer(name, `updatecheck ${attribute(check, 'status') ?? 'missing'}`);
      }
      const esb = attribute(check, '_esbAllowlist');
      return {
        version: checkedVersion(name, attribute(check, 'version')),
        ...(esb !== undefined && { esbTrusted: esb === 'true' }),
      };
    },
  },
  firefox: {
    name: 'Firefox Add-ons',
    defaultId: 'star-citizen-hangar-manager',
    url: (id) => `https://addons.mozilla.org/api/v5/addons/addon/${id}/`,
    listingUrl: (id) => `https://addons.mozilla.org/firefox/addon/${id}/`,
    parse: (status, body) => {
      const name = 'Firefox Add-ons';
      if (status === 404) return undefined;
      if (status !== 200) throw new UnexpectedAnswer(name, `HTTP ${status}`);
      const addon = json(name, body);
      // A disabled or not yet public add-on has no public version.
      if (addon.status !== 'public') return undefined;
      const current = addon.current_version as { version?: unknown } | null | undefined;
      return { version: checkedVersion(name, current?.version) };
    },
  },
  opera: {
    name: 'Opera Add-ons',
    defaultId: 'pnlcicdocajlpfaehmgclaonkclfcikm',
    url: (id) => `https://addons.opera.com/en/extensions/details/app_id/${id}/`,
    listingUrl: (id) => `https://addons.opera.com/en/extensions/details/app_id/${id}/`,
    parse: (status, body) => {
      const name = 'Opera Add-ons';
      if (status === 404) return undefined;
      if (status !== 200) throw new UnexpectedAnswer(name, `HTTP ${status}`);
      const version = /<dt>\s*Version\s*<\/dt>\s*<dd>\s*([^<\s]+)\s*<\/dd>/i.exec(body)?.[1];
      if (!version) throw new UnexpectedAnswer(name, 'no version on the listing page');
      return { version: checkedVersion(name, version) };
    },
  },
  edge: {
    name: 'Microsoft Edge Add-ons',
    url: (id) => `https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${id}`,
    listingUrl: (id) => `https://microsoftedge.microsoft.com/addons/detail/${id}`,
    parse: (status, body) => {
      const name = 'Microsoft Edge Add-ons';
      if (status === 404) return undefined;
      if (status !== 200) throw new UnexpectedAnswer(name, `HTTP ${status}`);
      const product = json(name, body);
      return { version: checkedVersion(name, product.version) };
    },
  },
};

export const isStoreId = (value: string): value is StoreId =>
  (STORE_IDS as readonly string[]).includes(value);

/** Identifies the workflow to the stores. */
export const USER_AGENT =
  'StarCitizenHangarManager-StoreReview/1.0 (+https://github.com/exrelax/star-citizen-hangar-manager)';

/** What the store lists for the extension: its listing, or `undefined` while it isn't listed. */
export async function readListing(
  store: Store,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Listing | undefined> {
  let response: Response;
  try {
    response = await fetchImpl(store.url(id), {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new UnexpectedAnswer(store.name, String(error));
  }
  return store.parse(response.status, await response.text());
}

/** Compares dotted versions: negative when `a` is older than `b`. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

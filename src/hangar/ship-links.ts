import { FLEETYARDS_DETAILS_BATCH_SIZE } from '@/config';
import type { Pledge } from './pledge';

/** Links of a ship to other platforms. */
export interface ShipLink {
  /** Fleetyards model slug, e.g. "anvl-f8c-lightning". */
  fleetyards: string;
  /** erkul.games ship id, e.g. "anvl_lightning_f8c". */
  erkul?: string;
}

/** Ship links by ship name as listed in the hangar. */
export type ShipLinks = Record<string, ShipLink>;

export const fleetyardsUrl = (slug: string) => `https://fleetyards.net/ships/${slug}/`;
export const erkulUrl = (id: string) => `https://www.erkul.games/ship/${id}`;

const FLEETYARDS_API = 'https://api.fleetyards.net/v1';

interface SlugEntry {
  slug: string;
  /** Manufacturer code, the first part of the slug ("anvl"). */
  code: string;
  words: Set<string>;
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function createSlugIndex(slugs: readonly string[]): SlugEntry[] {
  return slugs.map((slug) => {
    const [code = '', ...rest] = slug.split('-');
    return { slug, code, words: new Set(rest) };
  });
}

/**
 * Finds the Fleetyards slug of a hangar ship. The slug's words (without manufacturer) have to be
 * part of the ship name; the longest such slug wins, so "F8C Lightning Executive Edition" prefers
 * its own model over "F8C Lightning". With a known manufacturer code only its slugs qualify.
 */
export function matchFleetyardsSlug(
  name: string,
  manufacturerCode: string | undefined,
  index: readonly SlugEntry[],
): string | undefined {
  // Also allow two adjacent words written as one ("Star Kitten" → "starkitten").
  const nameList = words(name);
  const nameWords = new Set([
    ...nameList,
    ...nameList.slice(1).map((word, index) => nameList[index] + word),
  ]);
  const code = manufacturerCode?.toLowerCase();
  let best: SlugEntry | undefined;
  for (const entry of index) {
    if (code && entry.code !== code) continue;
    if (entry.words.size === 0 || ![...entry.words].every((word) => nameWords.has(word))) continue;
    if (!best || entry.words.size > best.words.size) best = entry;
  }
  return best?.slug;
}

export interface ShipLinkSource {
  fetchSlugs: () => Promise<string[]>;
  /** erkul ids by Fleetyards slug. */
  fetchErkulIds: (slugs: string[]) => Promise<Record<string, string>>;
}

/**
 * Resolves the links of all ships in the hangar. erkul ids already known from the previous sync
 * are reused, so only new ships cost a details request.
 */
export async function resolveShipLinks(
  pledges: readonly Pledge[],
  previous: ShipLinks | undefined,
  source: ShipLinkSource = fleetyardsSource,
): Promise<ShipLinks> {
  const index = createSlugIndex(await source.fetchSlugs());

  const links: ShipLinks = {};
  for (const pledge of pledges) {
    for (const item of pledge.items) {
      if (item.kind !== 'Ship' || item.title in links) continue;
      const slug = matchFleetyardsSlug(item.title, item.manufacturerCode, index);
      if (slug) links[item.title] = { fleetyards: slug };
    }
  }

  const knownErkulIds = new Map(
    Object.values(previous ?? {})
      .filter((link) => link.erkul)
      .map((link) => [link.fleetyards, link.erkul!]),
  );
  const missing = [...new Set(Object.values(links).map((link) => link.fleetyards))].filter(
    (slug) => !knownErkulIds.has(slug),
  );
  const fetched = missing.length ? await source.fetchErkulIds(missing) : {};

  for (const link of Object.values(links)) {
    link.erkul = knownErkulIds.get(link.fleetyards) ?? fetched[link.fleetyards];
  }
  return links;
}

/** Fleetyards allows requests from robertsspaceindustries.com (CORS), so the content script can call it. */
const fleetyardsSource: ShipLinkSource = {
  async fetchSlugs() {
    const response = await fetch(`${FLEETYARDS_API}/models/slugs`);
    if (!response.ok) throw new Error(`Loading Fleetyards slugs failed: HTTP ${response.status}`);
    return (await response.json()) as string[];
  },

  async fetchErkulIds(slugs) {
    const ids: Record<string, string> = {};
    for (let start = 0; start < slugs.length; start += FLEETYARDS_DETAILS_BATCH_SIZE) {
      const query = slugs
        .slice(start, start + FLEETYARDS_DETAILS_BATCH_SIZE)
        .map((slug) => `models[]=${encodeURIComponent(slug)}`)
        .join('&');
      const response = await fetch(`${FLEETYARDS_API}/models/embed?${query}`);
      if (!response.ok)
        throw new Error(`Loading Fleetyards models failed: HTTP ${response.status}`);
      for (const model of (await response.json()) as { slug: string; erkulIdentifier?: string }[]) {
        if (model.erkulIdentifier) ids[model.slug] = model.erkulIdentifier;
      }
    }
    return ids;
  },
};

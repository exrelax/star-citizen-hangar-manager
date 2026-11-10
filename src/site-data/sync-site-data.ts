import { SITE_DATA } from '@/config';
import { hashOf, recordCheck, recordSync, type MetaItem, type StorageMeta } from '@/storage/meta';
import { lastSiteDataReadTime } from './site-data-schedule';

/*
 * Keeps a stored data file of the project website current – the events (#69), the expected price
 * increases (#195): read at the times of `SITE_DATA.schedule` (see `site-data-schedule.ts`),
 * after a failure again after `SITE_DATA.retryMs` at the latest. A file that can't be read or isn't of the known format keeps the stored data.
 * Stored data of an earlier format (another `version`) is removed and read again at once.
 *
 * GitHub Pages serves the files to any origin, so no host permission is needed. The development
 * build reads the files of the working copy instead (each source's `fetch`), so new data can be
 * tried before it goes live – without a request to localhost, which Chrome would ask the user to
 * allow from RSI's page.
 */

/** A data file of the website and where it is kept. */
export interface SiteDataSource<D, S extends { version: number }> {
  /** For the console, e.g. "events". */
  name: string;
  item: {
    getValue(): Promise<S | null>;
    setValue(value: S): Promise<void>;
    removeValue(): Promise<void>;
  };
  meta: MetaItem;
  /** The format of the stored data; other versions are removed and read again. */
  version: number;
  /** The data of the file, checked; `undefined` for a file of another format. */
  fetch: () => Promise<D | undefined>;
  toSnapshot: (data: D) => S;
  fromSnapshot: (snapshot: S) => D;
}

/** The data after a refresh. */
export interface SiteDataResult<D> {
  /** The file's data, stored or just read; none if it was never read. */
  data: D | undefined;
  /** Whether `data` was read just now. */
  read: boolean;
}

/**
 * Whether the file is due to be read again: not read since the latest time of the schedule, or
 * failed at least `retryMs` ago.
 */
export function siteDataDue(
  meta: StorageMeta,
  now: number,
  { schedule, retryMs }: Pick<typeof SITE_DATA, 'schedule' | 'retryMs'> = SITE_DATA,
): boolean {
  if (meta.checkedAt < lastSiteDataReadTime(now, schedule)) return true;
  return meta.lastOutcome?.status === 'failed' && now - meta.checkedAt >= retryMs;
}

/** Loads a file of the website without cookies (it needs none, and it is another origin). */
export async function fetchSiteFile(url: string): Promise<unknown> {
  const response = await fetch(url, { credentials: 'omit', cache: 'no-cache' });
  if (!response.ok) throw new Error(`Loading ${url} failed: HTTP ${response.status}`);
  return response.json();
}

export interface RefreshOptions<D> {
  /** Read in any case, e.g. from "Stored data" in the settings. */
  force?: boolean;
  /** Instead of the source's `fetch`, for tests. */
  fetch?: () => Promise<D | undefined>;
  now?: () => number;
}

/**
 * Reads the file if due (`force`: in any case) and gives its data. `after` runs with the result
 * inside the same lock, e.g. to tell what became new; parallel calls share one run.
 */
export function createSiteDataSync<D, S extends { version: number }>(
  source: SiteDataSource<D, S>,
  after?: (result: SiteDataResult<D>, now: number) => Promise<void>,
) {
  let running: Promise<SiteDataResult<D>> | undefined;

  async function readFile(
    fetch: () => Promise<D | undefined>,
    now: () => number,
    meta: StorageMeta | undefined,
  ): Promise<D | undefined> {
    try {
      const data = await fetch();
      if (data === undefined) throw new Error(`The ${source.name} file has an unknown format`);
      const value = source.toSnapshot(data);
      const fingerprint = hashOf(value);
      const unchanged = meta?.fingerprint === fingerprint;
      if (!unchanged) await source.item.setValue(value);
      await recordSync(source.meta, {
        at: now(),
        fingerprint,
        ...(unchanged && { updatedAt: meta.updatedAt }),
      });
      return data;
    } catch (error) {
      console.warn(`[star-citizen-hangar-manager] ${source.name} unavailable`, error);
      await recordCheck(source.meta, { status: 'failed' }, { at: now() });
      return undefined;
    }
  }

  return function refresh({
    force = false,
    fetch = source.fetch,
    now = Date.now,
  }: RefreshOptions<D> = {}): Promise<SiteDataResult<D>> {
    running ??= (async () => {
      const [stored, meta] = await Promise.all([source.item.getValue(), source.meta.getValue()]);
      const current = stored?.version === source.version ? stored : null;
      const outdated = !!stored && !current;
      if (outdated) await source.item.removeValue();
      let result: SiteDataResult<D> = {
        data: current ? source.fromSnapshot(current) : undefined,
        read: false,
      };
      // Without stored data too only when due: a missing file is tried again at the next time of
      // the schedule, not on every check. Deleting the data in the settings deletes its metadata, so it is read
      // again.
      if (force || outdated || siteDataDue(meta, now())) {
        // Without anything current stored, the data is stored in any case.
        const data = await readFile(fetch, now, current ? meta : undefined);
        if (data !== undefined) result = { data, read: true };
      }
      await after?.(result, now());
      return result;
    })().finally(() => (running = undefined));
    return running;
  };
}

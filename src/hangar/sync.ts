import { mapWithConcurrency } from '@/shared/lib/pool';
import { hangarSnapshot } from './hangar-storage';
import { parsePledgePage, type PledgePage } from './parse-pledges';
import type { HangarSnapshot, Pledge } from './pledge';

export interface SyncProgress {
  done: number;
  total: number;
}

export interface SyncOptions {
  fetchPage?: (page: number) => Promise<PledgePage>;
  onProgress?: (progress: SyncProgress) => void;
  concurrency?: number;
}

/** Number of pledge pages requested at the same time – fast, but gentle on the RSI servers. */
const DEFAULT_CONCURRENCY = 3;

/**
 * Reads all pages of the hangar and stores them as a new snapshot. Nothing is stored unless every
 * page was read successfully, so a failed sync keeps the previous snapshot.
 */
export async function syncHangar(options: SyncOptions = {}): Promise<HangarSnapshot> {
  const { fetchPage = fetchPledgePage, onProgress, concurrency = DEFAULT_CONCURRENCY } = options;

  // The first page tells how many pages there are.
  const first = await fetchPage(1);
  const total = first.lastPage;
  let done = 1;
  onProgress?.({ done, total });

  const remaining = Array.from({ length: total - 1 }, (_, index) => index + 2);
  const rest = await mapWithConcurrency(remaining, concurrency, async (page) => {
    const result = await fetchPage(page);
    onProgress?.({ done: ++done, total });
    return result;
  });

  // Pledges can move between pages while syncing – keep each one once, in hangar order.
  const pledges = new Map<number, Pledge>();
  for (const page of [first, ...rest]) {
    for (const pledge of page.pledges) {
      if (!pledges.has(pledge.id)) pledges.set(pledge.id, pledge);
    }
  }

  const snapshot: HangarSnapshot = {
    syncedAt: new Date().toISOString(),
    pledges: [...pledges.values()],
  };
  await hangarSnapshot.setValue(snapshot);
  return snapshot;
}

/** Fetches a hangar page with the user's session. The English variant keeps dates parseable. */
async function fetchPledgePage(page: number): Promise<PledgePage> {
  const response = await fetch(`/en/account/pledges?page=${page}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Loading hangar page ${page} failed: HTTP ${response.status}`);

  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  // Logged out sessions get the login page instead of the hangar.
  if (!doc.querySelector('.list-items')) {
    throw new Error(`Hangar page ${page} has no pledge list – are you still logged in?`);
  }
  return parsePledgePage(doc);
}

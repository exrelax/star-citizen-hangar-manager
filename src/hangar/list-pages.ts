import { SYNC_CONCURRENCY } from '@/config';
import { mapWithConcurrency } from '@/shared/lib/pool';
import { PLEDGE_CATEGORIES, type PledgeCategory } from './pledge';
import type { ListEntry, ListPage } from './smart-update/check';
import { listPageWork, type ProgressSink } from './sync-progress';

/** All pages of RSI's full list (`undefined`) or of one of its category lists. */
export type ListPagesOf<T extends ListEntry> = (category?: PledgeCategory) => ListPage<T>[];

export interface ListPagesOptions<T extends ListEntry> {
  fetchPage: (page: number, category?: PledgeCategory) => Promise<ListPage<T>>;
  /** Entries per full page, to estimate the work of the pages not read yet. */
  pageSize: number;
  progress?: ProgressSink;
  concurrency?: number;
}

/**
 * Reads the first page of RSI's full list and of each category list – they tell how many pages
 * there are – and announces all pages to `progress`. The returned function reads the rest.
 * Splitting the two lets a sync of several lists show its total number of pages right away.
 */
export async function prepareListPages<T extends ListEntry>(
  options: ListPagesOptions<T>,
): Promise<() => Promise<ListPagesOf<T>>> {
  const { fetchPage, pageSize, progress, concurrency = SYNC_CONCURRENCY } = options;

  const lists: (PledgeCategory | undefined)[] = [undefined, ...PLEDGE_CATEGORIES];
  const firstPages = await Promise.all(lists.map((category) => fetchPage(1, category)));
  const remaining = lists.flatMap((category, index) =>
    Array.from({ length: firstPages[index]!.lastPage - 1 }, (_, page) => ({
      category,
      page: page + 2,
    })),
  );
  // Remaining pages are estimated as full; the last page of a list is often shorter.
  const pageWork = listPageWork(pageSize);
  const firstWork = firstPages.reduce((sum, page) => sum + listPageWork(page.pledges.length), 0);
  progress?.expect(firstPages.length + remaining.length, firstWork + remaining.length * pageWork);
  progress?.complete(firstPages.length, firstWork);

  return async () => {
    const rest = await mapWithConcurrency(remaining, concurrency, async ({ category, page }) => {
      const result = await fetchPage(page, category);
      progress?.complete(1, pageWork);
      return { category, result };
    });
    return (category) => [
      firstPages[lists.indexOf(category)]!,
      ...rest.filter((entry) => entry.category === category).map((entry) => entry.result),
    ];
  };
}

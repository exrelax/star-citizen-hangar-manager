import { BUYBACK_NARROWING } from '@/config';
import type { PledgeCategory } from '@/hangar/pledge';
import type { BuybackListPage } from './parse-buyback';
import type { FetchBuybackPage } from './sync-buyback';

/*
 * Narrowing down a failing buy back page (#339). RSI renders a list page as a whole, so one pledge
 * it can't render fails the page with all its 250 pledges. Such a page is read again in smaller
 * pages over the same range (250 → 50 → 10 → 1); a smaller page that works is kept, one that fails
 * is narrowed down further. A single pledge that still fails is skipped.
 *
 * The narrowing stays inside the failing range, so the page size grows again right after it: the
 * rest of a range of 10 is read in single pledges, the rest of a range of 50 in pages of 10, and so
 * on. Each size divides the one before, so these pages line up and none of them contains the
 * skipped position again.
 */

/** Positions (0-based, in RSI's list) skipped while reading a list. */
export interface SkippedPositions {
  category?: PledgeCategory;
  position: number;
  error: unknown;
}

/** Whether a failure is the page's own, not the session's or the connection's: a server error. */
export function isBrokenPage(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 500;
}

/**
 * `fetchPage` at the full page size, narrowing down a page that fails with a server error. Each
 * skipped position goes to `onSkip`; after `BUYBACK_NARROWING.maxSkipped` the original error is
 * thrown, as RSI is then broken itself rather than single pledges.
 */
export function narrowingFetchPage(
  fetchPage: FetchBuybackPage,
  onSkip: (skipped: SkippedPositions) => void = () => {},
  sizes: readonly number[] = BUYBACK_NARROWING.sizes,
  maxSkipped: number = BUYBACK_NARROWING.maxSkipped,
): FetchBuybackPage {
  let skipped = 0;
  const full = sizes[0]!;

  /** Reads `[start, start + sizes[level])` in pages of `sizes[level + 1]`. */
  async function narrow(
    start: number,
    level: number,
    category: PledgeCategory | undefined,
    original: unknown,
  ): Promise<{ page: BuybackListPage; ended: boolean }> {
    const size = sizes[level + 1]!;
    const parts = sizes[level]! / size;
    const pledges: BuybackListPage['pledges'] = [];
    let tokens: number | undefined;
    let total = 0;
    let worked = false;
    let ended = false;
    for (let part = 0; part < parts && !ended; part++) {
      const from = start + part * size;
      try {
        const page = await fetchPage(from / size + 1, category, size);
        worked = true;
        pledges.push(...page.pledges);
        tokens ??= page.tokens;
        total = Math.max(total, page.lastPage * size);
        // A short page is the end of the list: nothing comes after it.
        ended = page.pledges.length < size;
      } catch (error) {
        if (!isBrokenPage(error)) throw error;
        if (size > 1) {
          const inner = await narrow(from, level + 1, category, error);
          pledges.push(...inner.page.pledges);
          tokens ??= inner.page.tokens;
          total = Math.max(total, inner.page.lastPage * size);
          ended = inner.ended;
          if (inner.page.pledges.length) worked = true;
          continue;
        }
        if (++skipped > maxSkipped) throw original;
        onSkip({ category, position: from, error });
        total = Math.max(total, from + 1);
      }
    }
    // Nothing in the range could be read: not single pledges, RSI fails the whole list.
    if (!worked) throw original;
    const lastPage = Math.max(1, Math.ceil(total / sizes[level]!));
    return {
      page: { pledges, lastPage, ...(tokens !== undefined && { tokens }) },
      ended,
    };
  }

  return async (page, category, pageSize = full) => {
    try {
      return await fetchPage(page, category, pageSize);
    } catch (error) {
      if (!isBrokenPage(error) || pageSize !== full || sizes.length < 2) throw error;
      const { page: narrowed } = await narrow((page - 1) * full, 0, category, error);
      return narrowed;
    }
  };
}

import { describe, expect, it, vi } from 'vitest';
import type { BuybackPledge } from './buyback';
import { isBrokenPage, narrowingFetchPage, type SkippedPositions } from './narrow-pages';
import type { FetchBuybackPage } from './sync-buyback';

const SIZES = [20, 10, 5, 1];

/** A broken page answer, as `fetchHtml` throws it after its retries. */
const broken = () =>
  Object.assign(new Error('Loading buy back page failed: HTTP 500'), { status: 500 });

/**
 * A fake RSI list of `total` pledges (ids from `total` down to 1, newest first) whose pages fail
 * while they contain one of the `brokenAt` positions (0-based).
 */
function fakeList(total: number, brokenAt: number[]) {
  const requests: string[] = [];
  const fetchPage: FetchBuybackPage = async (page, _category, size = SIZES[0]!) => {
    requests.push(`${size}:${page}`);
    const from = (page - 1) * size;
    const to = Math.min(from + size, total);
    if (brokenAt.some((position) => position >= from && position < to)) throw broken();
    const pledges = Array.from({ length: Math.max(0, to - from) }, (_, index): BuybackPledge => ({
      id: total - from - index,
      title: `Pledge ${total - from - index}`,
      contained: '',
      isUpgrade: false,
    }));
    return { pledges, lastPage: Math.max(1, Math.ceil(total / size)) };
  };
  return { fetchPage, requests };
}

const read = async (total: number, brokenAt: number[], page = 1) => {
  const list = fakeList(total, brokenAt);
  const skipped: SkippedPositions[] = [];
  const fetchPage = narrowingFetchPage(list.fetchPage, (s) => skipped.push(s), SIZES, 5);
  const result = await fetchPage(page);
  return { result, skipped, requests: list.requests, ids: result.pledges.map((p) => p.id) };
};

describe('narrowingFetchPage (#339)', () => {
  it('reads a working page once', async () => {
    const { ids, requests, skipped } = await read(50, []);
    expect(ids).toHaveLength(20);
    expect(requests).toEqual(['20:1']);
    expect(skipped).toEqual([]);
  });

  it('skips only the pledge that breaks a page, in the middle', async () => {
    const { ids, skipped, result } = await read(50, [7]);
    expect(ids).toHaveLength(19);
    expect(ids).not.toContain(50 - 7);
    expect(skipped.map((s) => s.position)).toEqual([7]);
    // The pager still counts pages of the full size.
    expect(result.lastPage).toBe(3);
  });

  it('grows the page size again after the skipped pledge, never reading it again', async () => {
    const { requests } = await read(50, [7]);
    expect(requests).toEqual([
      '20:1', // fails
      '10:1', // positions 0–9 fail
      '5:1', // 0–4 work
      '5:2', // 5–9 fail
      '1:6',
      '1:7',
      '1:8', // position 7 fails and is skipped
      '1:9',
      '1:10',
      '10:2', // 10–19 in one page again
    ]);
  });

  it('tells the larger pages that failed before the skipped pledge (#342)', async () => {
    const { skipped } = await read(50, [7]);
    expect(skipped[0]?.attempts.map(({ page, size }) => `${size}:${page}`)).toEqual([
      '20:1',
      '10:1',
      '5:2',
    ]);
  });

  it('handles a broken pledge at the start and at the end of a page', async () => {
    expect((await read(50, [0])).skipped.map((s) => s.position)).toEqual([0]);
    const end = await read(50, [19]);
    expect(end.skipped.map((s) => s.position)).toEqual([19]);
    expect(end.ids).toHaveLength(19);
  });

  it('skips two broken pledges of one page', async () => {
    const { ids, skipped } = await read(50, [3, 14]);
    expect(skipped.map((s) => s.position)).toEqual([3, 14]);
    expect(ids).toHaveLength(18);
  });

  it('works on the last, shorter page of the list', async () => {
    const { ids, skipped } = await read(45, [42], 3);
    expect(skipped.map((s) => s.position)).toEqual([42]);
    expect(ids).toEqual([5, 4, 2, 1]);
  });

  it('gives up when RSI fails the whole range', async () => {
    const all = Array.from({ length: 50 }, (_, index) => index);
    await expect(read(50, all)).rejects.toThrow('HTTP 500');
  });

  it('gives up after too many skipped pledges', async () => {
    await expect(read(50, [0, 2, 4, 6, 8, 10])).rejects.toThrow('HTTP 500');
  });

  it("doesn't narrow failures that aren't the page's own", async () => {
    const fetchPage = vi.fn<FetchBuybackPage>(async () => {
      throw new Error('Buy back page 1 is no account page – are you still logged in?');
    });
    await expect(narrowingFetchPage(fetchPage, () => {}, SIZES)(1)).rejects.toThrow('logged in');
    expect(fetchPage).toHaveBeenCalledOnce();
  });
});

describe('isBrokenPage', () => {
  it('is true for server errors only', () => {
    expect(isBrokenPage(broken())).toBe(true);
    expect(isBrokenPage(Object.assign(new Error('HTTP 404'), { status: 404 }))).toBe(false);
    expect(isBrokenPage(new TypeError('Failed to fetch'))).toBe(false);
  });
});

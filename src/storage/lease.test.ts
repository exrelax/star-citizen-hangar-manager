import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { withLease } from './lease';

beforeEach(() => fakeBrowser.reset());

const KEY = 'local:test.lease';

describe('withLease', () => {
  it('runs one at a time and gives the lease back', async () => {
    let inner: unknown = 'not run';
    const outer = await withLease(KEY, 60_000, async () => {
      inner = await withLease(KEY, 60_000, async () => 'second');
      return 'first';
    });
    expect(outer).toBe('first');
    expect(inner).toBeUndefined();
    expect(await withLease(KEY, 60_000, async () => 'again')).toBe('again');
  });

  it('runs once a lease has run out', async () => {
    await storage.setItem(KEY, { until: 1000 });
    const run = vi.fn(async () => 'run');
    expect(await withLease(KEY, 60_000, run, () => 999)).toBeUndefined();
    expect(await withLease(KEY, 60_000, run, () => 1000)).toBe('run');
  });

  it('gives the lease back after a failure', async () => {
    await expect(
      withLease(KEY, 60_000, async () => {
        throw new Error('failed');
      }),
    ).rejects.toThrow('failed');
    expect(await storage.getItem(KEY)).toBeNull();
  });
});

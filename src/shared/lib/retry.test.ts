import { describe, expect, it, vi } from 'vitest';
import { isThrottled, withRetry } from './retry';

describe('withRetry', () => {
  it('tries throttled requests again and gives up after the last delay', async () => {
    const task = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('/api: HTTP 429'))
      .mockResolvedValueOnce('ok');
    expect(await withRetry(task, [1, 1], isThrottled)).toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);

    const always = vi.fn(async () => Promise.reject(new Error('/api: HTTP 429')));
    await expect(withRetry(always, [1, 1], isThrottled)).rejects.toThrow('HTTP 429');
    expect(always).toHaveBeenCalledTimes(3);
  });

  it('throws other errors right away', async () => {
    const task = vi.fn(async () => Promise.reject(new Error('HTTP 500')));
    await expect(withRetry(task, [1, 1], isThrottled)).rejects.toThrow('HTTP 500');
    expect(task).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { httpError, isThrottled, isTransient, parseRetryAfter, withRetry } from './retry';

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

describe('isTransient', () => {
  it('accepts throttling, server errors and no answer, not client errors', () => {
    expect(isTransient(new Error('Loading buy back page 2 failed: HTTP 429'))).toBe(true);
    expect(isTransient(new Error('Loading buy back page 2 failed: HTTP 502'))).toBe(true);
    expect(isTransient(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTransient(new Error('Loading buy back pledge 1 failed: HTTP 404'))).toBe(false);
    expect(isTransient(new Error('are you still logged in?'))).toBe(false);
  });
});

describe('httpError', () => {
  it('names the request and status, with the wait the server asks for', () => {
    const response = new Response(null, { status: 429, headers: { 'Retry-After': '3' } });
    const error = httpError('Loading buy back page 2', response);
    expect(error.message).toBe('Loading buy back page 2 failed: HTTP 429');
    expect(error.status).toBe(429);
    expect(error.retryAfterMs).toBe(3000);
  });
});

describe('parseRetryAfter', () => {
  it('reads seconds and HTTP dates', () => {
    const now = Date.UTC(2026, 10, 14, 10, 0, 0);
    expect(parseRetryAfter('5', now)).toBe(5000);
    expect(parseRetryAfter('Sat, 14 Nov 2026 10:00:10 GMT', now)).toBe(10_000);
    expect(parseRetryAfter('soon', now)).toBeUndefined();
    expect(parseRetryAfter(null, now)).toBeUndefined();
  });
});

describe('withRetry and Retry-After', () => {
  it('waits at least as long as the server asks', async () => {
    vi.useFakeTimers();
    try {
      const throttled = Object.assign(new Error('HTTP 429'), { retryAfterMs: 5000 });
      const task = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(throttled)
        .mockResolvedValueOnce('ok');
      const result = withRetry(task, [1], isTransient);
      await vi.advanceTimersByTimeAsync(4000);
      expect(task).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(await result).toBe('ok');
      expect(task).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

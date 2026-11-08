import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isCheckDue, isTimerActive, startSmartUpdateTimer, withSmartUpdateLock } from './schedule';

describe('isTimerActive', () => {
  it('runs only while the manager is shown in a visible tab', () => {
    expect(isTimerActive({ managerShown: true, hidden: false })).toBe(true);
    expect(isTimerActive({ managerShown: true, hidden: true })).toBe(false);
    expect(isTimerActive({ managerShown: false, hidden: false })).toBe(false);
  });
});

describe('isCheckDue', () => {
  const minute = 60_000;

  it('is due once the interval has passed', () => {
    expect(isCheckDue({ checkedAt: 0, intervalMinutes: 5, now: 5 * minute })).toBe(true);
    expect(isCheckDue({ checkedAt: 0, intervalMinutes: 5, now: 12 * minute })).toBe(true);
  });

  it('is not due within the interval', () => {
    expect(isCheckDue({ checkedAt: 0, intervalMinutes: 5, now: 5 * minute - 1 })).toBe(false);
  });
});

describe('startSmartUpdateTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('looks a step after the last look, only while active', async () => {
    let active = true;
    const check = vi.fn(async () => {});
    startSmartUpdateTimer(new AbortController().signal, () => active, check, 1000);

    expect(check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(check).toHaveBeenCalledTimes(2);

    // Tab hidden or another view shown: no checks, but it keeps looking.
    active = false;
    await vi.advanceTimersByTimeAsync(3000);
    expect(check).toHaveBeenCalledTimes(2);
    active = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('plans the next look only once a check is done', async () => {
    let finish = () => {};
    const check = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    startSmartUpdateTimer(new AbortController().signal, () => true, check, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    // A check taking longer than several steps: no second one meanwhile.
    await vi.advanceTimersByTimeAsync(5000);
    expect(check).toHaveBeenCalledTimes(1);

    finish();
    await vi.advanceTimersByTimeAsync(999);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('keeps looking after a failed check', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const check = vi.fn(async () => {
      throw new Error('offline');
    });
    startSmartUpdateTimer(new AbortController().signal, () => true, check, 1000);

    await vi.advanceTimersByTimeAsync(2000);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('stops once the content script is invalidated', async () => {
    const controller = new AbortController();
    const check = vi.fn(async () => {});
    startSmartUpdateTimer(controller.signal, () => true, check, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    controller.abort();
    await vi.advanceTimersByTimeAsync(5000);
    expect(check).toHaveBeenCalledTimes(1);
  });
});

describe('withSmartUpdateLock', () => {
  it('skips a run while another one holds the lock', async () => {
    let finish = () => {};
    const first = withSmartUpdateLock(
      () => new Promise<string>((resolve) => (finish = () => resolve('first'))),
    );
    // Another tab at the same time.
    const second = vi.fn(async () => 'second');
    await expect(withSmartUpdateLock(second)).resolves.toBeUndefined();
    expect(second).not.toHaveBeenCalled();

    finish();
    await expect(first).resolves.toBe('first');
    // Free again.
    await expect(withSmartUpdateLock(second)).resolves.toBe('second');
  });

  it('just runs without Web Locks', async () => {
    await expect(withSmartUpdateLock(async () => 'ran', null)).resolves.toBe('ran');
  });
});

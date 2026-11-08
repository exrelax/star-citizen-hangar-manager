import { describe, expect, it, vi } from 'vitest';
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
  it('checks on every step while active, and not while inactive', () => {
    let tick = () => {};
    const timers = { setInterval: vi.fn((handler: () => void) => (tick = handler)) };
    let active = true;
    const check = vi.fn();

    startSmartUpdateTimer(timers, () => active, check, 1000);
    expect(timers.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);

    tick();
    tick();
    expect(check).toHaveBeenCalledTimes(2);

    // Tab hidden or another view shown: no checks.
    active = false;
    tick();
    expect(check).toHaveBeenCalledTimes(2);
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

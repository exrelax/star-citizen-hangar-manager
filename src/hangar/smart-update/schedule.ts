import { SMART_UPDATE } from '@/config';

/*
 * When smart updates run (see `maybeRunSmartUpdate` in `../sync-state.ts`): a timer looks every
 * minute whether a check is due while the manager is shown in a visible tab, and a lock across
 * the tabs lets only one of them check at a time.
 */

/**
 * The timer only runs while the manager is shown and its tab is visible: no requests in the
 * background. The tab's `visibilitychange` catches up when it is shown again.
 */
export const isTimerActive = ({
  managerShown,
  hidden,
}: {
  managerShown: boolean;
  hidden: boolean;
}) => managerShown && !hidden;

/** Whether the last check (`checkedAt`, ms) is at least `intervalMinutes` old at `now`. */
export const isCheckDue = ({
  checkedAt,
  intervalMinutes,
  now,
}: {
  checkedAt: number;
  intervalMinutes: number;
  now: number;
}) => now - checkedAt >= intervalMinutes * 60_000;

/**
 * Looks every `stepMs` whether to `check` – only while `isActive()`. `check` decides itself
 * whether a check is due. `timers.setInterval` is the content script's (`ctx`), which stops the
 * timer when the script is invalidated (extension reloaded or updated).
 */
export function startSmartUpdateTimer(
  timers: { setInterval: (handler: () => void, timeout: number) => unknown },
  isActive: () => boolean,
  check: () => unknown,
  stepMs: number = SMART_UPDATE.timerStepMs,
): void {
  timers.setInterval(() => {
    if (isActive()) void check();
  }, stepMs);
}

const LOCK_NAME = 'star-citizen-hangar-manager:smart-update';

/**
 * Runs `run` unless another tab of the site runs it right now (a Web Lock, shared by the tabs of
 * robertsspaceindustries.com); then it is skipped and gives `undefined`. Without Web Locks, `run`
 * just runs.
 */
export async function withSmartUpdateLock<T>(
  run: () => Promise<T>,
  locks: LockManager | null = globalThis.navigator?.locks ?? null,
): Promise<T | undefined> {
  if (!locks) return run();
  return locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => (lock ? run() : undefined));
}

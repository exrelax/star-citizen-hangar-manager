import { SMART_UPDATE } from '@/config';

/*
 * When smart updates run (see `maybeRunSmartUpdate` in `../sync-state.ts`): a timer looks 10
 * seconds after the last look whether a check is due while the manager is shown in a visible tab, and a lock across
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
 * Looks `stepMs` after the last look whether to `check` – only while `isActive()`; `check`
 * decides itself whether a check is due. The next look is planned only once `check` is done (also
 * when it failed), so looks never overlap and the step counts from the end of a check.
 *
 * `signal` (the content script's `ctx.signal`) stops it when the script is invalidated (extension
 * reloaded or updated). Not `ctx.setTimeout`: it adds a listener for that on every call.
 */
export function startSmartUpdateTimer(
  signal: AbortSignal,
  isActive: () => boolean,
  check: () => Promise<unknown>,
  stepMs: number = SMART_UPDATE.timerStepMs,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const plan = () => {
    if (!signal.aborted) timer = setTimeout(look, stepMs);
  };
  const look = async () => {
    try {
      if (isActive()) await check();
    } catch (error) {
      console.warn('[star-citizen-hangar-manager] Smart update check failed', error);
    } finally {
      plan();
    }
  };
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  plan();
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

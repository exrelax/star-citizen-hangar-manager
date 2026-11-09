import { SMART_UPDATE } from '@/config';

/*
 * An adaptive interval for the smart updates (#125): while checks find nothing and nobody uses the
 * tab, the interval of the settings doubles after each check (5 → 10 → 20 minutes), up to
 * `SMART_UPDATE.backoff.maxFactor` times it. A check with changes, an own action on RSI's pages
 * (#124) or any input in a tab (pointer, keys, wheel) goes back to the set interval at once.
 *
 * The count of quiet checks is kept in the storage, shared by the tabs like `checkedAt`: every tab
 * waits for the same interval, so the backoff never makes several tabs check more often.
 */

/** Checks in a row that found nothing, with no input in between. */
const quietChecksItem = storage.defineItem<number>('local:smartUpdate.quietChecks', {
  fallback: 0,
});

/** The interval after `quietChecks` quiet checks, in minutes. */
export const backoffMinutes = (baseMinutes: number, quietChecks: number) =>
  baseMinutes * Math.min(SMART_UPDATE.backoff.maxFactor, 2 ** Math.max(0, quietChecks));

/** The interval the next check waits for, in minutes. */
export async function currentIntervalMinutes(baseMinutes: number): Promise<number> {
  return backoffMinutes(baseMinutes, await quietChecksItem.getValue());
}

/** After a check: changes go back to the set interval, nothing found lengthens it. */
export async function recordCheckResult(changed: boolean): Promise<void> {
  if (changed) return resetBackoff();
  const quiet = await quietChecksItem.getValue();
  // Beyond the cap the count changes nothing.
  if (2 ** quiet < SMART_UPDATE.backoff.maxFactor) await quietChecksItem.setValue(quiet + 1);
}

/** Back to the set interval (an own action, input in a tab). Writes only when it changes. */
export async function resetBackoff(): Promise<void> {
  if ((await quietChecksItem.getValue()) !== 0) await quietChecksItem.setValue(0);
}

/**
 * Input in the tab goes back to the set interval: pointer, keys and wheel (page events, no
 * permission), at most once per `SMART_UPDATE.backoff.inputThrottleMs`.
 */
export function watchInput(signal: AbortSignal, root: Document = document): void {
  let last = -Infinity;
  const onInput = (event: Event) => {
    if (!event.isTrusted) return;
    const now = performance.now();
    if (now - last < SMART_UPDATE.backoff.inputThrottleMs) return;
    last = now;
    void resetBackoff();
  };
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
    root.addEventListener(type, onInput, { capture: true, passive: true, signal });
  }
}

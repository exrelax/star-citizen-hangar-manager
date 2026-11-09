import { SMART_UPDATE } from '@/config';

/*
 * Own actions on RSI's pages (#124): exchanging (melting), gifting and applying an upgrade in "My
 * Gear" happen in RSI's own dialogs. When the user confirms one, a smart update runs right after
 * it, so every tab with the Hangar Manager shows the change within seconds instead of after the
 * interval. Only the user's own clicks are observed; nothing is clicked or sent on RSI's pages.
 *
 * RSI's dialogs (November 2026) are overlays `.js-lightbox` with a `form.legacy-form`, in one or two
 * steps (`.pane.step1`, `.pane.step2`). The step that carries out the action asks for the password:
 * its last submit button confirms ("SUBMIT", "Gift", "APPLY"). "CONTINUE", "NEXT" and "BACK" (not
 * the last one) and closing the dialog don't count.
 *
 * RSI may reload the page after the action, which would drop a timer: the action is remembered in
 * the storage, and the next page load (or the timer, whichever comes first) runs the check.
 */

/** When an own action was confirmed (epoch ms), until its check ran. */
const ownActionItem = storage.defineItem<number | null>('local:smartUpdate.ownActionAt', {
  fallback: null,
});

/** Whether a click on `target` confirms one of RSI's actions (see above). */
export function isConfirmingSubmit(target: Element): boolean {
  const button = target.closest('input[type="submit"], button[type="submit"], button:not([type])');
  const form = button?.closest('.js-lightbox form');
  if (!button || !form) return false;
  // The step of the button (or the whole form, when it has no steps) asks for the password.
  const step = button.closest('.pane') ?? form;
  if (!step.querySelector('input[type="password"]')) return false;
  const submits = step.querySelectorAll(
    'input[type="submit"], button[type="submit"], button:not([type])',
  );
  return submits[submits.length - 1] === button;
}

/** Remembers that an own action was just confirmed. */
export const rememberOwnAction = (now = Date.now()) => ownActionItem.setValue(now);

/**
 * Whether an own action waits for its check (confirmed at most `SMART_UPDATE.ownAction.maxAgeMs`
 * ago); it is taken, so only one check runs for it.
 */
export async function takeOwnAction(now = Date.now()): Promise<boolean> {
  const at = await ownActionItem.getValue();
  if (at === null) return false;
  await ownActionItem.removeValue();
  return now - at <= SMART_UPDATE.ownAction.maxAgeMs;
}

/**
 * Watches the user's clicks on the page for confirmed actions: each is remembered, and after
 * `SMART_UPDATE.ownAction.checkAfterMs` (RSI processing it) `check` runs – unless the page was
 * reloaded meanwhile, then the next page load runs it (see `takeOwnAction`).
 */
export function watchOwnActions(
  signal: AbortSignal,
  check: () => void,
  root: Document = document,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  root.addEventListener(
    'click',
    (event) => {
      if (!event.isTrusted || !(event.target instanceof Element)) return;
      if (!isConfirmingSubmit(event.target)) return;
      void rememberOwnAction();
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (await takeOwnAction()) check();
      }, SMART_UPDATE.ownAction.checkAfterMs);
    },
    // Capture: RSI's own handlers may stop the event from bubbling.
    { capture: true, signal },
  );
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
}

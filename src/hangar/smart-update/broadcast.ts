/*
 * Tells the other RSI tabs that a smart update check is running in this one, so a tab with the
 * Hangar Manager open shows "Checking …" too (see `checkingElsewhere` in `../sync-state.ts`). The
 * data a check finds needs no message: every tab reads the lists and their check state with
 * storage watchers, which `storage.onChanged` fires in all of them.
 *
 * Content scripts can't message each other directly, so the background passes the message on to
 * the RSI tabs. That needs no permission beyond the host permission for RSI.
 */

/** The tabs a message goes to: those the content script runs in. */
const RSI_TABS = 'https://robertsspaceindustries.com/*';

const CHECKING = 'shm:smart-update-checking';

export interface CheckingMessage {
  type: typeof CHECKING;
  /** `true` when the check started, `false` when it is done. */
  checking: boolean;
}

export const isCheckingMessage = (message: unknown): message is CheckingMessage =>
  typeof message === 'object' &&
  message !== null &&
  (message as CheckingMessage).type === CHECKING &&
  typeof (message as CheckingMessage).checking === 'boolean';

/** From a content script: a check started (`true`) or is done (`false`) in this tab. */
export function announceCheck(checking: boolean): void {
  const message: CheckingMessage = { type: CHECKING, checking };
  try {
    // No other tab may be open; the background is there, but nothing has to answer.
    void browser.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    // The content script was invalidated (extension reloaded): nobody to tell.
  }
}

/** In the background: passes `message` on to every RSI tab but the one it came from. */
export async function relayToOtherTabs(
  message: CheckingMessage,
  senderTabId: number | undefined,
): Promise<void> {
  const tabs = await browser.tabs.query({ url: RSI_TABS });
  await Promise.all(
    tabs
      .filter((tab) => tab.id !== undefined && tab.id !== senderTabId)
      // A tab still loading, or without the content script, has no listener: nothing lost.
      .map((tab) => browser.tabs.sendMessage(tab.id!, message).catch(() => undefined)),
  );
}

/** In a content script: calls `onChange` when a check starts or ends in another tab. */
export function listenForChecksElsewhere(onChange: (checking: boolean) => void): () => void {
  const listener = (message: unknown) => {
    if (isCheckingMessage(message)) onChange(message.checking);
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

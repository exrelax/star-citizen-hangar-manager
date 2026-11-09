import {
  ACTION_PARAM,
  type ManagerAction,
  type ManagerActionMessage,
} from '@/hangar/manager-action-message';

/*
 * One scheduler for the background script's work (#153): every alarm and every click on a browser
 * notification goes through one listener each, to the handler registered under its name. The
 * alarms survive a browser restart; the handlers are registered again whenever the background
 * script starts.
 */

const alarmHandlers = new Map<string, () => void>();
let listeningToAlarms = false;

/** Runs `handler` whenever the alarm `name` goes off. */
export function onAlarm(name: string, handler: () => void): void {
  alarmHandlers.set(name, handler);
  if (listeningToAlarms) return;
  listeningToAlarms = true;
  browser.alarms.onAlarm.addListener((alarm) => alarmHandlers.get(alarm.name)?.());
}

const clickHandlers = new Map<string, () => void>();
const buttonHandlers = new Map<string, ((index: number) => void) | undefined>();
let listeningToClicks = false;

/**
 * Runs `handler` on a click on the notification `id`. Without the `notifications` permission
 * there is nothing to listen to yet: `listenToNotificationClicks` is called again once it is
 * granted.
 */
export function onNotificationClick(
  id: string,
  handler: () => void,
  onButton?: (index: number) => void,
): void {
  clickHandlers.set(id, handler);
  buttonHandlers.set(id, onButton);
  listenToNotificationClicks();
}

/** Starts listening to clicks on notifications, once the browser has the API. */
export function listenToNotificationClicks(): void {
  if (listeningToClicks || !browser.notifications?.onClicked) return;
  listeningToClicks = true;
  browser.notifications.onClicked.addListener((id) => {
    const handler = clickHandlers.get(id);
    if (!handler) return;
    handler();
    void browser.notifications.clear(id);
  });
  // Buttons only exist in Chrome; Firefox shows none and has no such event.
  browser.notifications.onButtonClicked?.addListener((id, index) => {
    const handler = buttonHandlers.get(id);
    if (!handler) return;
    handler(index);
    void browser.notifications.clear(id);
  });
}

/** RSI's My Hangar with the Hangar Manager, where the notifications lead. */
export const HANGAR_MANAGER_URL =
  'https://robertsspaceindustries.com/en/account/pledges#hangar-manager';

/** The manager's URL carrying `action` for the content script (see `manager-action.ts`). */
export function managerUrl(action: ManagerAction): string {
  if (action === 'open') return HANGAR_MANAGER_URL;
  const url = new URL(HANGAR_MANAGER_URL);
  url.searchParams.set(ACTION_PARAM, action);
  return url.href;
}

/** Whether the tab shows RSI's My Hangar, where the manager lives. */
export const isHangarTab = (url: string | undefined) =>
  !!url &&
  /^https:\/\/robertsspaceindustries\.com\/(?:[a-z]{2}\/)?account\/pledges\/?(?:[?#]|$)/.test(url);

/**
 * Opens the Hangar Manager for a notification (#154) and does `action` there: in an open My Hangar
 * tab (focused, the action as a message), else in another RSI tab or a new one (the action in the
 * URL).
 */
export async function openHangarManager(action: ManagerAction = 'open'): Promise<void> {
  const tabs = await browser.tabs.query({ url: 'https://robertsspaceindustries.com/*' });
  const byRecent = [...tabs].sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  const focus = async (tab: Browser.tabs.Tab) => {
    await browser.tabs.update(tab.id!, { active: true });
    if (tab.windowId !== undefined) await browser.windows.update(tab.windowId, { focused: true });
  };
  const hangar = byRecent.find((tab) => tab.id !== undefined && isHangarTab(tab.url));
  if (hangar) {
    await focus(hangar);
    const message: ManagerActionMessage = { type: 'shm:manager-action', action };
    const taken = await browser.tabs.sendMessage(hangar.id!, message).catch(() => false);
    // No content script there (e.g. the extension was updated meanwhile): load it anew.
    if (!taken) await browser.tabs.update(hangar.id!, { url: managerUrl(action) });
    return;
  }
  const other = byRecent.find((tab) => tab.id !== undefined);
  if (other) {
    await browser.tabs.update(other.id!, { url: managerUrl(action) });
    await focus(other);
    return;
  }
  await browser.tabs.create({ url: managerUrl(action) });
}

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
let listeningToClicks = false;

/**
 * Runs `handler` on a click on the notification `id`. Without the `notifications` permission
 * there is nothing to listen to yet: `listenToNotificationClicks` is called again once it is
 * granted.
 */
export function onNotificationClick(id: string, handler: () => void): void {
  clickHandlers.set(id, handler);
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
}

/** My Hangar with the Hangar Manager, where the notifications lead. */
export const HANGAR_MANAGER_URL =
  'https://robertsspaceindustries.com/en/account/pledges#hangar-manager';

/** Opens My Hangar with the Hangar Manager in a new tab. */
export const openHangarManager = () => void browser.tabs.create({ url: HANGAR_MANAGER_URL });

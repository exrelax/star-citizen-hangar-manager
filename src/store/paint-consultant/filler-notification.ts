import { onAlarm, onNotificationClick, openHangarManager } from '@/background/dispatch';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import { meltableAt } from '@/hangar/melt-marks';
import { HANGAR_SNAPSHOT_VERSION } from '@/hangar/pledge';
import { translate } from '@/i18n';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { resolveLanguage } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { REBUY_PLAN_VERSION, rebuyPlanItem, type FillerPurchase } from './rebuy-plan-storage';

/*
 * The browser notification that the Paint Discount Consultant's filler paints can be melted
 * (#105), shown by the background script also while no RSI page is open: an alarm goes off 24
 * hours after their order. Only once per purchase, and only while the browser allows the
 * extension's notifications (#152); the sidebar tells it in any case. A click opens My Hangar,
 * where the sidebar offers to melt them at once.
 */

export const FILLER_ALARM = 'shm-consultant-fillers';
const NOTIFICATION_ID = 'shm-consultant-fillers';

/** When the filler paints can be melted, in ms: 24 hours after their order. */
export const fillersMeltableAt = (purchase: FillerPurchase) =>
  meltableAt({ boughtAt: purchase.boughtAt, markedAt: purchase.foundAt });

/** The kept plan's purchase that wasn't told yet, if any. */
async function untoldPurchase() {
  const plan = await rebuyPlanItem.getValue();
  if (plan?.version !== REBUY_PLAN_VERSION || !plan.purchase || plan.purchase.notifiedAt) {
    return undefined;
  }
  return { plan, purchase: plan.purchase };
}

/** Sets the alarm for the kept plan's filler paints, or tells them now if they are due. */
export async function scheduleFillerNotification(now = Date.now()): Promise<void> {
  const untold = await untoldPurchase();
  if (!untold) {
    await browser.alarms.clear(FILLER_ALARM);
    return;
  }
  const when = fillersMeltableAt(untold.purchase);
  if (when <= now) await notifyFillers();
  else await browser.alarms.create(FILLER_ALARM, { when });
}

/** Shows the notification (if allowed) for the filler paints still in the hangar, once. */
export async function notifyFillers(): Promise<void> {
  const untold = await untoldPurchase();
  if (!untold) return;
  const { plan, purchase } = untold;
  const snapshot = await hangarSnapshot.getValue();
  const inHangar =
    snapshot?.version === HANGAR_SNAPSHOT_VERSION
      ? new Set(snapshot.pledges.map((pledge) => pledge.id))
      : undefined;
  const left = inHangar
    ? purchase.pledgeIds.filter((id) => inHangar.has(id)).length
    : purchase.pledgeIds.length;
  if (left && (await browserNotificationsItem.getValue())) {
    const locale = resolveLanguage(withDefaults(await settingsItem.getValue()).language);
    await browser.notifications.create(NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: translate(locale, 'consultant.fillers.notificationTitle'),
      message:
        left === 1
          ? translate(locale, 'consultant.fillers.readyOne')
          : translate(locale, 'consultant.fillers.ready', [left]),
    });
  }
  await rebuyPlanItem.setValue({ ...plan, purchase: { ...purchase, notifiedAt: Date.now() } });
}

/** Wires the alarm and the click on the notification (call it in the background script). */
export function watchFillerNotification(): void {
  void scheduleFillerNotification();
  rebuyPlanItem.watch(() => void scheduleFillerNotification());
  onAlarm(FILLER_ALARM, () => void notifyFillers());
  onNotificationClick(NOTIFICATION_ID, () => void openHangarManager());
}

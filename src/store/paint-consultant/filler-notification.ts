import {
  onAlarm,
  onManagerSeen,
  onNotificationClick,
  openHangarManager,
} from '@/background/dispatch';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import { meltableAt } from '@/hangar/melt-marks';
import { HANGAR_SNAPSHOT_VERSION } from '@/hangar/pledge';
import { translate, translatePlural } from '@/i18n';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { isKindOn } from '@/notifications/kinds';
import { resolveLanguage } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { currentPlanOf, rebuyPlanItem, type FillerPurchase } from './rebuy-plan-storage';

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
  const plan = currentPlanOf(await rebuyPlanItem.getValue());
  if (!plan?.purchase || plan.purchase.notifiedAt) {
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
  const { purchase } = untold;
  const snapshot = await hangarSnapshot.getValue();
  const inHangar =
    snapshot?.version === HANGAR_SNAPSHOT_VERSION
      ? new Set(snapshot.pledges.map((pledge) => pledge.id))
      : undefined;
  const left = inHangar
    ? purchase.pledgeIds.filter((id) => inHangar.has(id)).length
    : purchase.pledgeIds.length;
  const settings = withDefaults(await settingsItem.getValue());
  // The kind "can be melted" turned off (#197): told, but not shown.
  const kindOn = isKindOn(settings.notificationsOff, 'meltReady');
  if (left && kindOn && (await browserNotificationsItem.getValue())) {
    const locale = resolveLanguage(settings.language);
    await browser.notifications.create(NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: translate(locale, 'consultant.fillers.notificationTitle'),
      message: translatePlural(locale, 'consultant.fillers.ready', left),
    });
  }
  // Read again: the plan may have changed (or ended) while the notification was shown.
  const current = currentPlanOf(await rebuyPlanItem.getValue());
  if (current?.purchase?.orderId !== purchase.orderId) return;
  await rebuyPlanItem.setValue({
    ...current,
    purchase: { ...current.purchase, notifiedAt: Date.now() },
  });
}

/**
 * Takes the notification away once its filler paints are gone from the hangar (melted) (#155).
 * Closing it otherwise is up to the user, or to seeing the Hangar Manager, whose sidebar offers to
 * melt them.
 */
export async function clearMeltedFillers(): Promise<void> {
  const [plan, snapshot] = await Promise.all([rebuyPlanItem.getValue(), hangarSnapshot.getValue()]);
  const purchase = currentPlanOf(plan)?.purchase;
  if (!purchase?.notifiedAt || snapshot?.version !== HANGAR_SNAPSHOT_VERSION) return;
  const inHangar = new Set(snapshot.pledges.map((pledge) => pledge.id));
  if (!purchase.pledgeIds.some((id) => inHangar.has(id))) {
    await browser.notifications?.clear(NOTIFICATION_ID);
  }
}

/** Wires the alarm and the click on the notification (call it in the background script). */
export function watchFillerNotification(): void {
  void scheduleFillerNotification();
  rebuyPlanItem.watch((plan) => {
    // A plan discarded or completed (#245): its notification goes with it.
    if (!plan) void browser.notifications?.clear(NOTIFICATION_ID);
    void scheduleFillerNotification();
  });
  onAlarm(FILLER_ALARM, () => void notifyFillers());
  hangarSnapshot.watch(() => void clearMeltedFillers());
  // The kind turned off (#197): its notification goes.
  settingsItem.watch((settings) => {
    if (!isKindOn(withDefaults(settings).notificationsOff, 'meltReady')) {
      void browser.notifications?.clear(NOTIFICATION_ID);
    }
  });
  onManagerSeen(() => void browser.notifications?.clear(NOTIFICATION_ID));
  onNotificationClick(NOTIFICATION_ID, () => void openHangarManager());
}

import {
  onAlarm,
  onManagerSeen,
  onNotificationClick,
  onNotificationClosed,
  openHangarManager,
} from '@/background/dispatch';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import { meltableAt, meltMarksItem, type MeltMarks } from '@/hangar/melt-marks';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from '@/hangar/pledge';
import { hangarPurchases } from '@/hangar/use-melt-marks';
import { translate, type Locale } from '@/i18n';
import type { OrdersSnapshot } from '@/orders/orders';
import { ordersSnapshot } from '@/orders/orders-storage';
import { resolveLanguage } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { rebuyPlanItem } from '@/store/paint-consultant/rebuy-plan-storage';
import { browserNotificationsItem } from './browser-permission';

/*
 * The browser notification that pledges marked to melt (#97, #144) can be melted now (#153),
 * shown by the background script also while no RSI page is open. An alarm goes off at the
 * earliest time one of them can be melted – the same time the sidebar shows (`meltableAt`) – and
 * one notification names all that can be melted then. Each pledge is announced once, and only one
 * marked while it was still waiting: a mark on a pledge that can be melted already tells nothing
 * new.
 *
 * Only marks of pledges in this device's stored hangar count: the marks follow the browser profile,
 * and each device notifies by its own hangar. The Paint Discount Consultant's filler paints have
 * their own notification (`filler-notification.ts`) and are left out here. Without the browser's
 * permission, or in the demo mode, nothing is shown, but the pledges count as told, so turning it
 * on later doesn't bring old ones.
 */

export const MELT_READY_ALARM = 'shm-melt-ready';
const NOTIFICATION_ID = 'shm-melt-ready';

/** The pledges already announced, with the time they could be melted from. */
const notifiedItem = storage.defineItem<Readonly<Record<string, number>>>(
  'local:notifications.meltReadyNotified',
  { fallback: {} },
);

/**
 * The pledges the browser notification shown now is about. It goes away once none of them can be
 * melted any more (melted, unmarked), once the Hangar Manager is seen – its sidebar tells the same –
 * or when the user closes it (#155).
 */
const shownItem = storage.defineItem<readonly number[]>('local:notifications.meltReadyShown', {
  fallback: [],
});

/** A marked pledge of this device's hangar, with when it can be melted. */
export interface MeltCandidate {
  pledgeId: number;
  title: string;
  meltableAt: number;
}

/**
 * The marked pledges of the hangar that were still waiting for RSI's 24 hours when marked, with
 * their times, but not those left out (filler paints).
 */
export function meltCandidates(
  marks: MeltMarks,
  hangar: HangarSnapshot | null | undefined,
  orders: OrdersSnapshot | null | undefined,
  leftOut: ReadonlySet<number> = new Set(),
): MeltCandidate[] {
  if (hangar?.version !== HANGAR_SNAPSHOT_VERSION) return [];
  const pledges = new Map(hangar.pledges.map((pledge) => [pledge.id, pledge]));
  const purchases = hangarPurchases(hangar.pledges, orders);
  return Object.entries(marks).flatMap(([id, markedAt]) => {
    const pledgeId = Number(id);
    const pledge = pledges.get(pledgeId);
    if (!pledge || leftOut.has(pledgeId)) return [];
    const purchase = purchases.get(pledgeId);
    const at = meltableAt({ boughtAt: purchase?.at, boughtOn: purchase?.on, markedAt });
    // Meltable already when marked: the row shows "Melt now" right away, nothing to wait for. Marks
    // may also just collect pledges; a notification on every click would be noise.
    if (at <= markedAt) return [];
    return [{ pledgeId, title: pledge.title, meltableAt: at }];
  });
}

/** What to do at `now`: the pledges to announce now, and when to look again. */
export function meltSchedule(
  candidates: readonly MeltCandidate[],
  notified: Readonly<Record<string, number>>,
  now: number,
): { due: MeltCandidate[]; next?: number } {
  const open = candidates.filter((candidate) => notified[candidate.pledgeId] === undefined);
  const due = open.filter((candidate) => candidate.meltableAt <= now);
  const later = open.filter((candidate) => candidate.meltableAt > now);
  return {
    due,
    ...(later.length && { next: Math.min(...later.map((candidate) => candidate.meltableAt)) }),
  };
}

/** The current candidates, from the storage. */
async function loadCandidates(): Promise<MeltCandidate[]> {
  const [marks, hangar, orders, plan] = await Promise.all([
    meltMarksItem.getValue(),
    hangarSnapshot.getValue(),
    ordersSnapshot.getValue(),
    rebuyPlanItem.getValue(),
  ]);
  return meltCandidates(marks, hangar, orders, new Set(plan?.purchase?.pledgeIds ?? []));
}

/**
 * Announces the pledges that can be melted now and sets the alarm for the next one. Pledges no
 * longer marked are forgotten, so marking one again announces it again.
 */
export async function checkMeltReady(now = Date.now()): Promise<void> {
  const [candidates, notified, allowed, settings] = await Promise.all([
    loadCandidates(),
    notifiedItem.getValue(),
    browserNotificationsItem.getValue(),
    settingsItem.getValue(),
  ]);
  const { demoMode, language } = withDefaults(settings);
  const shown = allowed && !demoMode;
  const { due, next } = meltSchedule(candidates, notified, now);
  // The pledges of the notification shown, as far as they can still be melted.
  const readyNow = new Set(
    candidates.filter((c) => c.meltableAt <= now).map((candidate) => candidate.pledgeId),
  );
  const before = await shownItem.getValue();
  let showing = before.filter((id) => readyNow.has(id));
  if (due.length && shown) {
    showing = [...new Set([...showing, ...due.map((candidate) => candidate.pledgeId)])];
    await announce(
      candidates.filter((candidate) => showing.includes(candidate.pledgeId)),
      resolveLanguage(language),
    );
  } else if (before.length && !showing.length) {
    await clearShown();
  }
  if (showing.length !== before.length) await shownItem.setValue(showing);

  const marked = new Set(candidates.map((candidate) => String(candidate.pledgeId)));
  const kept = Object.fromEntries(
    [
      ...Object.entries(notified),
      ...due.map((c) => [String(c.pledgeId), c.meltableAt] as const),
    ].filter(([id]) => marked.has(id)),
  );
  if (JSON.stringify(kept) !== JSON.stringify(notified)) await notifiedItem.setValue(kept);

  // An alarm only while notifications can be shown; turning them on checks again.
  if (next === undefined || !shown) await browser.alarms.clear(MELT_READY_ALARM);
  else await browser.alarms.create(MELT_READY_ALARM, { when: next });
}

/** Takes the notification away, e.g. once the Hangar Manager was seen. */
async function clearShown(): Promise<void> {
  await shownItem.setValue([]);
  await browser.notifications?.clear(NOTIFICATION_ID);
}

/** One notification for all of them. */
async function announce(due: readonly MeltCandidate[], locale: Locale): Promise<void> {
  await browser.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: translate(locale, 'notifications.browserMeltReadyTitle'),
    message:
      due.length === 1
        ? translate(locale, 'notifications.browserMeltReadyOne', [due[0]!.title])
        : translate(locale, 'notifications.browserMeltReady', [due.length]),
    // Firefox shows no buttons and refuses the option: there a click opens the manager.
    ...(!import.meta.env.FIREFOX && {
      buttons: [
        { title: translate(locale, 'notifications.showReady') },
        { title: translate(locale, 'notifications.selectReady') },
      ],
    }),
  });
}

/** Wires the alarm, the click and the data it follows (call it in the background script). */
export function watchMeltReady(): void {
  const check = () => void checkMeltReady();
  check();
  for (const item of [meltMarksItem, hangarSnapshot, ordersSnapshot, rebuyPlanItem]) {
    item.watch(check);
  }
  browserNotificationsItem.watch(check);
  settingsItem.watch(check);
  onAlarm(MELT_READY_ALARM, check);
  onManagerSeen(() => void clearShown());
  onNotificationClosed(NOTIFICATION_ID, () => void shownItem.setValue([]));
  onNotificationClick(
    NOTIFICATION_ID,
    () => void openHangarManager(),
    // The buttons (Chrome): "Show" and "Select", like the sidebar's.
    (index) => void openHangarManager(index === 0 ? 'showMeltReady' : 'selectMeltReady'),
  );
}

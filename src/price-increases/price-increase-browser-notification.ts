import {
  onAlarm,
  onManagerSeen,
  onNotificationClick,
  onNotificationClosed,
  openHangarManager,
} from '@/background/dispatch';
import { buybackSnapshot } from '@/buyback/buyback-storage';
import { PRICE_INCREASES } from '@/config';
import { translate, type Locale } from '@/i18n';
import { browserNotificationsItem } from '@/notifications/browser-permission';
import { isKindOn } from '@/notifications/kinds';
import { resolveLanguage } from '@/settings/language';
import { settingsItem, withDefaults } from '@/settings/settings';
import { storedPriceIncreasePledges, type StoredPriceIncreasePledge } from './price-increase-notes';
import { endOf } from './price-increases';
import { priceIncreasesItem, storedPriceIncreases } from './price-increases-storage';

/*
 * The browser notification about buy back pledges whose price is expected to rise in less than
 * two days (#193, `PRICE_INCREASES.browserNoticeMs`), shown by the background script also while no
 * RSI page is open. An alarm goes off when the next pledge crosses that limit, and one
 * notification names all pledges that crossed it then – never one per pledge. Each pledge is told
 * once per price increase; a price increase moved in the file tells it again.
 *
 * It goes away once none of its pledges has the price increase ahead any more (over, bought back),
 * once the Hangar Manager is seen – its sidebar tells the same – or when closed (#155). Without the
 * browser's permission, with the kind turned off (#197) or in the demo mode nothing is shown, but
 * the pledges count as told, so turning it on later doesn't bring old ones.
 */

export const PRICE_INCREASE_ALARM = 'shm-price-increase';
const NOTIFICATION_ID = 'shm-price-increase';

/** The pledges already told, with the time of the price increase they were told for. */
const notifiedItem = storage.defineItem<Readonly<Record<string, number>>>(
  'local:notifications.priceIncreaseNotified',
  { fallback: {} },
);

/** The pledges the browser notification shown now is about. */
const shownItem = storage.defineItem<readonly number[]>('local:notifications.priceIncreaseShown', {
  fallback: [],
});

/** When a pledge crosses the limit: `browserNoticeMs` before its price increase. */
const noticeAt = (pledge: StoredPriceIncreasePledge) =>
  pledge.priceIncrease.increase.priceIncreaseAt.at - PRICE_INCREASES.browserNoticeMs;

/** What to do at `now`: the pledges to tell now, and when to look again. */
export function priceIncreaseSchedule(
  pledges: readonly StoredPriceIncreasePledge[],
  notified: Readonly<Record<string, number>>,
  now: number,
): { due: StoredPriceIncreasePledge[]; next?: number } {
  const open = pledges.filter(
    (pledge) =>
      notified[pledge.id] !== pledge.priceIncrease.increase.priceIncreaseAt.at &&
      endOf(pledge.priceIncrease.increase.priceIncreaseAt) > now,
  );
  const due = open.filter((pledge) => noticeAt(pledge) <= now);
  const later = open.filter((pledge) => noticeAt(pledge) > now);
  return { due, ...(later.length && { next: Math.min(...later.map(noticeAt)) }) };
}

/** The pledges of the stored buy back with a price increase ahead, from the storage. */
async function loadPledges(now: number): Promise<StoredPriceIncreasePledge[]> {
  const [buyback, increases] = await Promise.all([
    buybackSnapshot.getValue(),
    priceIncreasesItem.getValue(),
  ]);
  return storedPriceIncreasePledges(buyback, storedPriceIncreases(increases), now);
}

/** Tells the pledges that crossed the limit and sets the alarm for the next one. */
export async function checkPriceIncreases(now = Date.now()): Promise<void> {
  const [pledges, notified, allowed, settings] = await Promise.all([
    loadPledges(now),
    notifiedItem.getValue(),
    browserNotificationsItem.getValue(),
    settingsItem.getValue(),
  ]);
  const { demoMode, language, notificationsOff } = withDefaults(settings);
  const shown = allowed && !demoMode && isKindOn(notificationsOff, 'priceIncreases');
  const { due, next } = priceIncreaseSchedule(pledges, notified, now);

  // The pledges of the notification shown, as far as their price increase is still ahead.
  const ahead = new Set(pledges.map((pledge) => pledge.id));
  const before = await shownItem.getValue();
  let showing = before.filter((id) => ahead.has(id));
  if (due.length && shown) {
    showing = [...new Set([...showing, ...due.map((pledge) => pledge.id)])];
    await announce(
      pledges.filter((pledge) => showing.includes(pledge.id)),
      resolveLanguage(language),
    );
  } else if (before.length && (!showing.length || !shown)) {
    await clearShown();
    showing = [];
  }
  if (showing.length !== before.length) await shownItem.setValue(showing);

  // Only pledges still ahead are kept, so the stored list doesn't grow.
  const kept = Object.fromEntries(
    [
      ...Object.entries(notified),
      ...due.map(
        (pledge) => [String(pledge.id), pledge.priceIncrease.increase.priceIncreaseAt.at] as const,
      ),
    ].filter(([id]) => ahead.has(Number(id))),
  );
  if (JSON.stringify(kept) !== JSON.stringify(notified)) await notifiedItem.setValue(kept);

  if (next === undefined || !shown) await browser.alarms.clear(PRICE_INCREASE_ALARM);
  else await browser.alarms.create(PRICE_INCREASE_ALARM, { when: next });
}

/** Takes the notification away, e.g. once the Hangar Manager was seen. */
async function clearShown(): Promise<void> {
  await shownItem.setValue([]);
  await browser.notifications?.clear(NOTIFICATION_ID);
}

/** The ships of the pledges, each once, e.g. "Galaxy, Liberator". */
const shipsOf = (pledges: readonly StoredPriceIncreasePledge[], locale: Locale) =>
  new Intl.ListFormat(locale, { type: 'conjunction' }).format([
    ...new Set(pledges.map((pledge) => pledge.priceIncrease.increase.ship.name)),
  ]);

/** One notification for all of them. */
async function announce(
  pledges: readonly StoredPriceIncreasePledge[],
  locale: Locale,
): Promise<void> {
  await browser.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: translate(locale, 'notifications.browserPriceIncreaseTitle'),
    message:
      pledges.length === 1
        ? translate(locale, 'notifications.browserPriceIncreaseOne', [
            pledges[0]!.title,
            shipsOf(pledges, locale),
          ])
        : translate(locale, 'notifications.browserPriceIncrease', [
            pledges.length,
            shipsOf(pledges, locale),
          ]),
  });
}

/** Wires the alarm, the click and the data it follows (call it in the background script). */
export function watchPriceIncreases(): void {
  const check = () => void checkPriceIncreases();
  check();
  for (const item of [buybackSnapshot, priceIncreasesItem]) item.watch(check);
  browserNotificationsItem.watch(check);
  settingsItem.watch(check);
  onAlarm(PRICE_INCREASE_ALARM, check);
  onManagerSeen(() => void clearShown());
  onNotificationClosed(NOTIFICATION_ID, () => void shownItem.setValue([]));
  onNotificationClick(NOTIFICATION_ID, () => void openHangarManager('showPriceIncreases'));
}

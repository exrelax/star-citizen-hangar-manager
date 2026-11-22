import type { StarCitizenEvent } from '@/events/events';
import type { UpgradeTarget } from '@/ships/upgrade-dialog-labels';
import type { WarbondSighting } from '@/store/warbond-history';
import { demoEvents } from './demo-events';

/*
 * The countdown of target ships in RSI's ship upgrade dialog (#570) in the demo (#572): the demo's
 * events instead of the website's – without a running event (demo setting "A running event") only
 * the upcoming one, so no countdown shows –, and instead of the website's warbond offers made-up
 * ones for every tenth target ship that isn't always available (by id, so some show in every price
 * range of the dialog), expected to end two weeks after the event: those ships count down to it,
 * the others to the event's end. Always available ships and the base ships show none, as outside
 * the demo.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Every how many target ships that aren't always available one has a later warbond end. */
const WARBOND_EVERY = 10;

export interface DemoCountdownSources {
  events: StarCitizenEvent[];
  offers: WarbondSighting[];
}

/**
 * `targets`: the ship ids RSI sells CCUs to (the stored upgrade tool), `availability` whether a
 * ship is always available.
 */
export function demoCountdownSources(
  now: number,
  runningEvent: boolean,
  targets: readonly number[],
  availability: (target: UpgradeTarget) => boolean | undefined,
): DemoCountdownSources {
  const events = demoEvents(now).filter((event) => runningEvent || now < event.eventStart);
  const running = events.find((event) => event.eventStart <= now && now < event.eventEnd);
  const limited = [...new Set(targets)]
    .sort((a, b) => a - b)
    .filter((id) => availability({ id }) === false);
  if (!running) return { events, offers: [] };
  const offers = limited
    .filter((_, index) => index % WARBOND_EVERY === 0)
    .map((shipId): WarbondSighting => ({
      shipId,
      skuId: shipId,
      shipName: '',
      price: 1,
      msrp: 2,
      firstSeen: running.eventStart,
      lastSeen: now,
      expectedEnd: running.eventEnd + 14 * DAY,
    }));
  return { events, offers };
}

import { EVENTS_VERSION, eventsItem } from '@/events/events-storage';
import type { Ship, WarbondSku } from '@/ships/ships';
import { recordWarbondOffers } from './warbond-history';
import { warbondHistoryItem } from './warbond-history-storage';

/**
 * Adds the warbond offers of a read of the upgrade tool to the stored history (#4), with the
 * events of the project website running at the time.
 */
export async function recordWarbondHistory(
  warbonds: readonly WarbondSku[],
  ships: readonly Ship[],
  at: number,
): Promise<void> {
  const [history, events] = await Promise.all([
    warbondHistoryItem.getValue(),
    eventsItem.getValue(),
  ]);
  const known = events?.version === EVENTS_VERSION ? events.events : [];
  const next = recordWarbondOffers(history, warbonds, ships, known, at);
  if (next !== history) await warbondHistoryItem.setValue(next);
}

import type { DayOrTime } from '@/site-data/site-data';
import { hangarCcus, type RemovalCcus, type RemovalLevel } from './removal-ccus';
import { removalsByDate, type ShipRemoval } from './ship-removals';

/*
 * The sidebar's notifications about ship removals (#290, part of Ship Removals #285): one per date,
 * listing all ships removed on it, with the section of the Pledge Store tab (#288). Ships with CCUs
 * from them in the hangar are warned about, each by the level of #287: yellow-orange
 * while there are as many CCUs to the ship, red with fewer. Its × dismisses it for these ships on
 * this date, kept in the sync storage like the Price Increase Advisor's; a new ship or a new date
 * shows it again. Past dates don't show.
 */

/** A dismissed notification: its date and its ships' ids. */
export const removalNoteKey = (removedAt: DayOrTime, ships: readonly ShipRemoval[]): string =>
  `${removedAt.at}${removedAt.dayOnly ? 'd' : ''}:${ships
    .map((removal) => removal.ship.id)
    .sort((a, b) => a - b)
    .join(',')}`;

/** The removal notifications dismissed (`removalNoteKey`). */
export const dismissedRemovalNotesItem = storage.defineItem<string[]>(
  'sync:shipRemovals.dismissed',
  { fallback: [] },
);

/** The dismissed ones of the demo mode, apart from the real ones. */
export const demoDismissedRemovalNotesItem = storage.defineItem<string[]>(
  'local:demo.dismissedShipRemovals',
  { fallback: [] },
);

/** A ship of the notification with CCUs from it in the hangar: how many, how many to it, the level. */
export interface RemovalWarning {
  removal: ShipRemoval;
  from: number;
  to: number;
  level: RemovalLevel;
}

export interface RemovalNote {
  key: string;
  removedAt: DayOrTime;
  /** All ships removed on the date, by name. */
  ships: ShipRemoval[];
  /** The ships with CCUs from them, red first. */
  warnings: RemovalWarning[];
  /** The highest level of the warnings, if any. */
  level?: RemovalLevel;
}

/** The notifications to show, the next date first. */
export function removalNotes(
  list: readonly RemovalCcus[],
  now: number,
  dismissed: readonly string[],
): RemovalNote[] {
  const byShip = new Map(list.map((entry) => [entry.removal.ship.id, entry]));
  const hidden = new Set(dismissed);
  return removalsByDate(
    list.map((entry) => entry.removal),
    now,
  ).flatMap(({ removedAt, removals }) => {
    const key = removalNoteKey(removedAt, removals);
    if (hidden.has(key)) return [];
    const warnings = removals
      .flatMap((removal): RemovalWarning[] => {
        const entry = byShip.get(removal.ship.id);
        return entry?.level
          ? [{ removal, from: hangarCcus(entry.from), to: entry.to.length, level: entry.level }]
          : [];
      })
      .sort((a, b) => Number(b.level === 'critical') - Number(a.level === 'critical'));
    const level = warnings[0]?.level;
    return [{ key, removedAt, ships: removals, warnings, ...(level && { level }) }];
  });
}

/** The keys of the notifications still ahead, for keeping the dismissed list short. */
export const removalNoteKeys = (removals: readonly ShipRemoval[], now: number): Set<string> =>
  new Set(
    removalsByDate(removals, now).map(({ removedAt, removals: ships }) =>
      removalNoteKey(removedAt, ships),
    ),
  );

/** Shows the dismissed notifications again (the settings, #213). */
export async function restoreRemovalNotes(): Promise<void> {
  await Promise.all([
    dismissedRemovalNotesItem.removeValue(),
    demoDismissedRemovalNotesItem.removeValue(),
  ]);
}

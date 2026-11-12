import type { CcuPriceChange } from './ccu-price-change';
import type { SecureOffer } from './ccus-to-secure';
import { isWithinDays, type ExpectedPriceIncrease } from './price-increases';

/*
 * The Price Increase Advisor's notifications in the sidebar (#254, part of #248), one per expected
 * price increase within the period of the Buy Back Reminder (#192):
 * - With CCUs of the hangar whose base ship rises (they lose upgrade value, #250): their number and
 *   the total loss, with the filter "Price change ahead" and the advice (#252).
 * - Without such CCUs, if RSI sells CCUs to the ship (#253): a hint that one can still be bought at
 *   the old price, with the Pledge Store tab's section. It can be turned off in the settings.
 * Its × dismisses it for this price increase – the ship and its date –, kept in the sync storage
 * like the Buy Back Reminder's; a new or moved increase shows again. Past ones don't show. Sidebar
 * only: no browser notification.
 */

/** A dismissed price increase: the ship's id and the date it was dismissed for. */
export const advisorNoteKey = (increase: ExpectedPriceIncrease) =>
  `${increase.ship.id}@${increase.priceIncreaseAt.at}`;

/** The price increases the sidebar's notifications were dismissed for (`advisorNoteKey`). */
export const dismissedAdvisorNotesItem = storage.defineItem<string[]>(
  'sync:priceAdvisor.dismissed',
  { fallback: [] },
);

/** The dismissed ones of the demo mode, apart from the real ones. */
export const demoDismissedAdvisorNotesItem = storage.defineItem<string[]>(
  'local:demo.dismissedPriceAdvisor',
  { fallback: [] },
);

/** A CCU of the hangar, as far as the notification needs it. */
export interface AdvisorCcu {
  id: number;
  ccuPriceChange?: CcuPriceChange;
}

export type AdvisorNote =
  | {
      kind: 'losing';
      key: string;
      increase: ExpectedPriceIncrease;
      /** The CCUs that lose upgrade value, in the hangar's order. */
      ccuIds: number[];
      /** What they lose together in USD, only if known for each of them. */
      loss?: number;
    }
  | { kind: 'secure'; key: string; increase: ExpectedPriceIncrease };

export interface AdvisorNoteInput {
  ccus: readonly AdvisorCcu[];
  /** The CCUs RSI sells to rising ships now (`ccusToSecure`). */
  secure: readonly SecureOffer[];
  now: number;
  days: number;
  /** Whether the hint without affected CCUs shows (the settings). */
  secureHint: boolean;
  dismissed: readonly string[];
}

const cents = (value: number) => Math.round(value * 100) / 100;

/** The notifications to show, the next price increase first. */
export function advisorNotes(input: AdvisorNoteInput): AdvisorNote[] {
  const dismissed = new Set(input.dismissed);
  const losing = new Map<string, { increase: ExpectedPriceIncrease; ccus: AdvisorCcu[] }>();
  for (const ccu of input.ccus) {
    const change = ccu.ccuPriceChange;
    const base = change?.base;
    if (change?.direction !== 'loses' || !base) continue;
    if (!isWithinDays(base, input.now, input.days)) continue;
    const key = advisorNoteKey(base);
    const group = losing.get(key) ?? { increase: base, ccus: [] };
    group.ccus.push(ccu);
    losing.set(key, group);
  }

  const notes: AdvisorNote[] = [...losing].map(([key, { increase, ccus }]) => {
    const changes = ccus.map((ccu) => ccu.ccuPriceChange?.amounts?.change);
    const known = changes.every((change) => change !== undefined);
    return {
      kind: 'losing',
      key,
      increase,
      ccuIds: ccus.map((ccu) => ccu.id),
      ...(known && { loss: cents(-changes.reduce<number>((sum, change) => sum + change!, 0)) }),
    };
  });

  if (input.secureHint) {
    // The ships rising without affected CCUs, by id: one CCU of them is enough to tell the loss.
    const affected = new Set([...losing.values()].map(({ increase }) => increase.ship.id));
    for (const offer of input.secure) {
      const { increase } = offer;
      if (affected.has(increase.ship.id) || !isWithinDays(increase, input.now, input.days)) {
        continue;
      }
      notes.push({ kind: 'secure', key: advisorNoteKey(increase), increase });
    }
  }

  return notes
    .filter((note) => !dismissed.has(note.key))
    .sort((a, b) => a.increase.priceIncreaseAt.at - b.increase.priceIncreaseAt.at);
}

/**
 * The dismissed price increases with `key` added; those no longer ahead (`aheadKeys`) are left
 * out, so the stored list doesn't grow.
 */
export const withDismissed = (
  dismissed: readonly string[],
  key: string,
  aheadKeys: ReadonlySet<string>,
): string[] => [...new Set([...dismissed.filter((other) => aheadKeys.has(other)), key])];

/** Whether a price increase still ahead was dismissed: the settings can bring it back (#213). */
export const hasDismissedAhead = (
  dismissed: readonly string[],
  aheadKeys: ReadonlySet<string>,
): boolean => dismissed.some((key) => aheadKeys.has(key));

/** Shows the dismissed notifications again (the settings, #213). */
export async function restoreAdvisorNotes(): Promise<void> {
  await Promise.all([
    dismissedAdvisorNotesItem.removeValue(),
    demoDismissedAdvisorNotesItem.removeValue(),
  ]);
}

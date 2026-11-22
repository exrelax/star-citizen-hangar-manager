import { meltableAt } from '@/hangar/melt-marks';
import { translate, type Locale } from '@/i18n';
import { addItem, createWatchlist, type Watchlist } from './watchlists';

/*
 * The watchlist of the Paint Discount Consultant's filler paints (#473): once the order that bought
 * the plan is found, its filler paints go onto a watchlist of their own, with a reminder when they
 * can be melted – 24 hours after the order, as their marks to melt (#97) tell, which stay. Its id
 * comes from the order, so several tabs make it once, and a watchlist the user changed or deleted
 * isn't made again.
 */

/** The id of the filler paints' watchlist of an order. */
export const fillerWatchlistId = (orderId: string): string =>
  `fill${orderId.toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 32);

/** The watchlist of the filler paints an order bought; none without filler paints. */
export function fillerWatchlist(input: {
  orderId: string;
  /** When the order created them ("2026-11-09T19:55"), if known. */
  boughtAt?: string;
  /** The filler paints' pledges with their titles. */
  fillers: readonly { id: number; title: string }[];
  /** When the plan started, for its name. */
  planAt: number;
  now: number;
  locale: Locale;
}): Watchlist | undefined {
  if (!input.fillers.length) return undefined;
  const date = new Intl.DateTimeFormat(input.locale, { dateStyle: 'medium' }).format(input.planAt);
  let list = createWatchlist(
    {
      name: translate(input.locale, 'watchlists.fillerName', [date]),
      description: translate(input.locale, 'watchlists.fillerDescription'),
      dueAt: meltableAt({ boughtAt: input.boughtAt, markedAt: input.now }),
      reminder: true,
      storeAlerts: false,
    },
    input.now,
    fillerWatchlistId(input.orderId),
  );
  for (const filler of input.fillers) {
    list = addItem(list, { kind: 'hangar', pledgeId: filler.id, name: filler.title }, input.now);
  }
  return list;
}

import { translate, type Locale } from '@/i18n';
import { countdown, formatExpectedTime } from '@/price-increases/price-increase-label';
import type { ShipRemoval } from './ship-removals';

/*
 * The badge of a ship leaving the Pledge Store (#288): a countdown to its date, as the price
 * increases' badges (#195), and a tooltip with the date, which is CIG's announcement. In the
 * Pledge Store tab and the table of all ships (#410).
 */

export interface RemovalLabel {
  text: string;
  hint: string;
}

export const removalLabel = (removal: ShipRemoval, now: number, locale: Locale): RemovalLabel => ({
  text: translate(locale, 'shipRemovals.label', [countdown(removal.removedAt, now, locale)]),
  hint: `${translate(locale, 'shipRemovals.hint', [
    removal.ship.name,
    formatExpectedTime(removal.removedAt, locale),
  ])}\n${translate(locale, 'shipRemovals.announced')}`,
});

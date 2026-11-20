import type { TokenRenewal } from '@/buyback-tokens/token-renewals';

/*
 * The next renewal of the buy back tokens in the demo (#434): the website's file is public, so the
 * demo shows its real next date; the demo settings can show a date announced by CIG, an estimated
 * one or none instead, so each text of the tooltip can be shown.
 */

export const TOKEN_RENEWAL_CASES = ['real', 'confirmed', 'estimated', 'none'] as const;
export type TokenRenewalCase = (typeof TOKEN_RENEWAL_CASES)[number];

/** Where the demo's own dates come from: CIG announces them on Spectrum once a year. */
const DEMO_SOURCE = {
  name: 'Spectrum: Buy Back Token Schedule',
  url: 'https://robertsspaceindustries.com/spectrum/community/SC/forum/1',
};

/** The first Monday of the quarter after `now`, as a day (UTC). */
export function nextQuarterMonday(now: number): number {
  const date = new Date(now);
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  const first = Date.UTC(date.getUTCFullYear(), quarter * 3, 1);
  const weekday = new Date(first).getUTCDay();
  return first + ((8 - weekday) % 7) * 24 * 60 * 60 * 1000;
}

/**
 * The renewal of a case: `undefined` for the website's (`real`), `null` for none, else a made-up
 * one on the first Monday of the next quarter, with the source of the website's next date if any.
 */
export function demoTokenRenewal(
  kind: TokenRenewalCase,
  real: TokenRenewal | undefined,
  now: number,
): TokenRenewal | null | undefined {
  if (kind === 'real') return undefined;
  if (kind === 'none') return null;
  const source = real?.source ?? DEMO_SOURCE;
  const at = { at: nextQuarterMonday(now), dayOnly: true as const };
  return kind === 'confirmed'
    ? { at, confirmed: true, source }
    : {
        at,
        confirmed: false,
        note: {
          en: 'Estimated: the first Monday of the quarter, as in the year before.',
          de: 'Geschätzt: der erste Montag des Quartals, wie im Jahr davor.',
          fr: 'Estimation : le premier lundi du trimestre, comme l’année précédente.',
          es: 'Estimado: el primer lunes del trimestre, como el año anterior.',
        },
        source,
      };
}

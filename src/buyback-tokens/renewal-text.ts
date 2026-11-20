import { i18n, type Locale } from '@/i18n';
import { localized } from '@/site-data/site-data';
import type { TokenRenewal } from './token-renewals';

/** The date of a renewal in the locale's format; a day without a time (#434). */
export function renewalDate(renewal: TokenRenewal, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    ...(renewal.at.dayOnly ? { timeZone: 'UTC' } : { timeStyle: 'short' }),
  }).format(renewal.at.at);
}

/** The sentence on a renewal: announced, or probably and estimated. */
export const renewalSentence = (renewal: TokenRenewal, locale: Locale): string =>
  i18n.t(renewal.confirmed ? 'buyback.renewal' : 'buyback.renewalEstimated', [
    renewalDate(renewal, locale),
  ]);

/** The renewal as plain text – sentence, note and source –, e.g. as an accessible description. */
export const renewalText = (renewal: TokenRenewal, locale: Locale): string =>
  [
    renewalSentence(renewal, locale),
    renewal.note && localized(renewal.note, locale),
    `${i18n.t('buyback.renewalSource')} ${renewal.source.name}`,
  ]
    .filter(Boolean)
    .join('\n');

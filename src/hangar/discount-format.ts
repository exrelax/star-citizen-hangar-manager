import { i18n, type Locale } from '@/i18n';
import type { PledgeDiscount } from './ship-prices';

/** Formatters per locale, shared by all rows (creating them per row is slow for long lists). */
const formatters = new Map<
  string,
  { usd: Intl.NumberFormat; cents: Intl.NumberFormat; percent: Intl.NumberFormat }
>();

function formattersOf(locale: Locale) {
  let entry = formatters.get(locale);
  if (!entry) {
    const currency = { style: 'currency', currency: 'USD' } as const;
    entry = {
      usd: new Intl.NumberFormat(locale, { ...currency, maximumFractionDigits: 0 }),
      cents: new Intl.NumberFormat(locale, { ...currency, minimumFractionDigits: 2 }),
      percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }),
    };
    formatters.set(locale, entry);
  }
  return entry;
}

/** An amount in USD: whole dollars without cents ("$25"), otherwise with ("$12.50"). */
export function formatUsd(value: number, locale: Locale): string {
  const { usd, cents } = formattersOf(locale);
  return Number.isInteger(value) ? usd.format(value) : cents.format(value);
}

/** What the row shows for a discount: the short text and the explanation for its tooltip. */
export function formatDiscount(discount: PledgeDiscount, locale: Locale) {
  const { percent } = formattersOf(locale);
  const money = (value: number) => formatUsd(value, locale);

  const isSurcharge = discount.amount < 0;
  const amount = money(Math.abs(discount.amount));
  const share = percent.format(Math.abs(discount.percent) / 100);
  const [first, second] = discount.ships;
  // "Constellation Mk V Centaurus $300 − Guardian QI $260 = $40" for CCUs.
  const source =
    first && second
      ? `${second.name} ${money(second.price)} − ${first.name} ${money(first.price)} = ${money(discount.original)}`
      : `${first?.name} ${money(discount.original)}`;
  return {
    isSurcharge,
    text: `${isSurcharge ? '+' : '−'}${amount} (${share})`,
    title: i18n.t(isSurcharge ? 'pledge.surchargeTitle' : 'pledge.discountTitle', [
      source,
      money(discount.paid),
      amount,
      share,
    ]),
  };
}

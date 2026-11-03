import { i18n } from '@/i18n';

/*
 * Insurances of a pledge. A pledge can contain several (e.g. after CCUs), but only the best one
 * counts in Star Citizen: lifetime insurance, then the one with the most months.
 */

export type Insurance = { lifetime: true } | { lifetime: false; months: number };

/** "Lifetime Insurance", "120 Month Insurance" → the insurance; anything else → undefined. */
export function parseInsurance(title: string): Insurance | undefined {
  if (!/\binsurance\b/i.test(title)) return undefined;
  if (/\blifetime\b/i.test(title)) return { lifetime: true };
  const months = /(\d+)\s*months?\b/i.exec(title)?.[1];
  return months ? { lifetime: false, months: Number(months) } : undefined;
}

/** The best of the insurances among the given item titles, if any. */
export function bestInsurance(titles: Iterable<string>): Insurance | undefined {
  let best: Insurance | undefined;
  for (const title of titles) {
    const insurance = parseInsurance(title);
    if (insurance && (!best || isBetter(insurance, best))) best = insurance;
  }
  return best;
}

function isBetter(insurance: Insurance, than: Insurance): boolean {
  if (than.lifetime) return false;
  return insurance.lifetime || insurance.months > than.months;
}

/** "LTI", or the duration – in years where the months add up to whole years ("10 years"). */
export function insuranceLabel(insurance: Insurance): string {
  if (insurance.lifetime) return 'LTI';
  const { months } = insurance;
  if (months % 12 === 0) {
    const years = months / 12;
    return i18n.t(years === 1 ? 'insurance.year' : 'insurance.years', [years]);
  }
  return i18n.t(months === 1 ? 'insurance.month' : 'insurance.months', [months]);
}

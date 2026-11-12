import { postRsiJson } from '@/shared/rsi-api';
import { parseAmount } from './parse-pledges';
import type { PriceLookup } from './ship-prices';

/*
 * The CCUs applied to a pledge, from the log behind RSI's "Upgrades" button in "My Gear". It is
 * loaded only when opened in the manager (one small request) and kept for the page's lifetime.
 */

/** One applied CCU. */
export interface UpgradeLogEntry {
  /** "YYYY-MM-DD HH:mm" (RSI's time, as shown by RSI), or RSI's text if it can't be read. */
  appliedAt: string;
  /** Pledge id of the applied CCU, if given. */
  ccuId?: number;
  /** e.g. "Upgrade - Prowler to 600i Explorer Warbond Edition". */
  name: string;
  /** Value of the pledge after this CCU, in USD. */
  valueAfter?: number;
  /** What this CCU added to the value: the step from the previous entry (not for the first). */
  added?: number;
}

/** An applied CCU with the original prices of its ships (see `ship-prices.ts`). */
export interface PricedUpgradeLogEntry extends UpgradeLogEntry {
  /** Original price of the target ship. */
  targetPrice?: number;
  /**
   * Original price difference of the two ships minus what the CCU added; negative if more. For the
   * first CCU it includes the base pledge (`withBase`).
   */
  discount?: number;
  /**
   * The first CCU: RSI doesn't log the pledge's value before it, so the base pledge and this CCU
   * can't be told apart. Its discount is theirs together: the target ship's price minus the value
   * after this CCU (#241).
   */
  withBase?: true;
}

/** Applied CCUs of a pledge, oldest first (RSI lists them newest first). */
export async function fetchUpgradeLog(pledgeId: number): Promise<UpgradeLogEntry[]> {
  const response = await postRsiJson<{
    success: number;
    msg?: string;
    data?: { rendered?: string };
  }>('/api/account/upgradeLog', { pledge_id: pledgeId });
  if (response.success !== 1) throw new Error(response.msg ?? 'Request failed');
  return parseUpgradeLog(response.data?.rendered ?? '');
}

const cache = new Map<number, Promise<UpgradeLogEntry[]>>();

/** `fetchUpgradeLog`, loaded once per pledge; a failed request is tried again next time. */
export function loadUpgradeLog(pledgeId: number, fetchLog = fetchUpgradeLog) {
  let log = cache.get(pledgeId);
  if (!log) {
    log = fetchLog(pledgeId);
    cache.set(pledgeId, log);
    log.catch(() => cache.delete(pledgeId));
  }
  return log;
}

// "Upgrade applied: #34489525 Upgrade - Prowler to 600i Explorer Warbond Edition, new value: $180.00 USD"
const APPLIED = /^upgrade applied:\s*(?:#(\d+)\s+)?(.+?)\s*,\s*new value:\s*(.+)$/i;

/** The rows RSI renders for the log: `<div class="row"><label>date<br><span>text</span>…`. */
export function parseUpgradeLog(html: string): UpgradeLogEntry[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const entries = [...doc.querySelectorAll('.row label')].map((label): UpgradeLogEntry => {
    const text = clean(label.querySelector('span')?.textContent);
    const date = clean(label.firstChild?.textContent);
    const match = APPLIED.exec(text);
    return {
      appliedAt: parseLogDate(date) ?? date,
      ccuId: match?.[1] ? Number(match[1]) : undefined,
      name: match?.[2] ?? text,
      valueAfter: match ? parseAmount(match[3]!) : undefined,
    };
  });
  entries.reverse();
  for (let index = 1; index < entries.length; index++) {
    const [before, after] = [entries[index - 1]!.valueAfter, entries[index]!.valueAfter];
    if (before !== undefined && after !== undefined) {
      entries[index]!.added = Math.round((after - before) * 100) / 100;
    }
  }
  return entries;
}

// "Upgrade - 300i to Spartan Warbond Edition", "Upgrade - F7C-M Super Hornet to Zeus Mk II MR
// Standard Upgrade": the ships, without the edition at the end.
const CCU_NAME =
  /^upgrade\s*-\s*(.+?)\s+to\s+(.+?)(?:\s+(?:standard|warbond)(?:\s+(?:edition|upgrade))?)?$/i;

/** The two ships of a CCU name, if it has the usual form. */
export function ccuShips(name: string): { from: string; to: string } | undefined {
  const match = CCU_NAME.exec(name.trim());
  return match ? { from: match[1]!, to: match[2]!.replace(/\s+edition$/i, '') } : undefined;
}

/**
 * Adds the original price of each CCU's target ship and the discount of the CCU: what the price
 * difference of its ships would cost, minus what it added to the pledge. The first CCU has no
 * known step (RSI doesn't log the value before it): its discount is that of the base pledge and
 * the CCU together, the target ship's price minus the value after it (#241). So the discounts add
 * up to the pledge's discount against its current ship's price.
 */
export function withPrices(
  entries: readonly UpgradeLogEntry[],
  priceOf: PriceLookup,
): PricedUpgradeLogEntry[] {
  return entries.map((entry, index) => {
    const ships = ccuShips(entry.name);
    const from = ships && priceOf(ships.from);
    const to = ships && priceOf(ships.to);
    if (index === 0) {
      const discount =
        to && entry.valueAfter !== undefined ? cents(to.price - entry.valueAfter) : undefined;
      return { ...entry, targetPrice: to?.price, discount, withBase: true };
    }
    const discount =
      from && to && entry.added !== undefined
        ? cents(to.price - from.price - entry.added)
        : undefined;
    return { ...entry, targetPrice: to?.price, discount };
  });
}

/** The sum of the discounts, if every one is known. */
export function totalDiscount(entries: readonly PricedUpgradeLogEntry[]): number | undefined {
  if (!entries.length || entries.some((entry) => entry.discount === undefined)) return undefined;
  return cents(entries.reduce((sum, entry) => sum + entry.discount!, 0));
}

const cents = (value: number) => Math.round(value * 100) / 100;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "Nov 26 2023, 6:03 am" → "2023-11-26 06:03". */
export function parseLogDate(value: string): string | undefined {
  const match =
    /^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*([ap]m)$/i.exec(value);
  if (!match) return undefined;
  const month = MONTHS.indexOf(match[1]!.toLowerCase()) + 1;
  if (!month) return undefined;
  const hour = (Number(match[4]) % 12) + (match[6]!.toLowerCase() === 'pm' ? 12 : 0);
  const pad = (part: string | number) => String(part).padStart(2, '0');
  return `${match[3]}-${pad(month)}-${pad(match[2]!)} ${pad(hour)}:${match[5]}`;
}

const clean = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() ?? '';

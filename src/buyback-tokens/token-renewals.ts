import { BUYBACK_TOKENS } from '@/config';
import {
  dayOrTime,
  endOf,
  httpsUrl,
  localizedText,
  record,
  text,
  type DayOrTime,
  type LocalizedText,
} from '@/site-data/site-data';

/*
 * When RSI renews the buy back tokens (#434), from the project website (`data/buyback-tokens.json`,
 * see "Editing the buy back token renewals" in DEVELOPMENT.md): dates CIG announced (`confirmed`)
 * or estimated from an earlier schedule, each with the source it comes from. The tooltip of the
 * tokens names the next one.
 */

/** A source of renewal dates, e.g. CIG's schedule of a year on Spectrum. */
export interface RenewalSource {
  name: string;
  url: string;
}

export interface TokenRenewal {
  at: DayOrTime;
  /** Announced by CIG; else estimated, e.g. from the schedule of the year before. */
  confirmed: boolean;
  /** What an estimate is based on, or a remark on a confirmed date. */
  note?: LocalizedText;
  source: RenewalSource;
}

const MAX_NAME = 150;

function parseSource(entry: unknown): TokenRenewal[] {
  const raw = record(entry);
  const name = text(raw?.name, MAX_NAME);
  const url = httpsUrl(raw?.url);
  if (!raw || !name || !url || !Array.isArray(raw.renewals)) return [];
  const source = { name, url };
  return raw.renewals.flatMap((item): TokenRenewal[] => {
    const renewal = record(item);
    const at = dayOrTime(renewal?.at);
    if (!renewal || !at) return [];
    const note = localizedText(renewal.note);
    // A date without `confirmed: true` counts as an estimate.
    return [{ at, confirmed: renewal.confirmed === true, ...(note && { note }), source }];
  });
}

/**
 * The renewals of the website's file, of every source; `undefined` if it isn't one of the format
 * the extension reads (another `schemaVersion`, no list of sources), so the stored ones are kept.
 * Sources and dates that don't fit are left out.
 */
export function parseTokenRenewals(json: unknown): TokenRenewal[] | undefined {
  const file = record(json);
  if (!file || file.schemaVersion !== BUYBACK_TOKENS.schemaVersion) return undefined;
  if (!Array.isArray(file.sources)) return undefined;
  return file.sources.flatMap(parseSource);
}

/**
 * The next renewal at `now`: the earliest of all sources not over yet (a day counts until its
 * end); a confirmed date before an estimate of the same time. None without one.
 */
export function nextTokenRenewal(
  renewals: readonly TokenRenewal[],
  now: number,
): TokenRenewal | undefined {
  return renewals
    .filter((renewal) => endOf(renewal.at) > now)
    .sort((a, b) => a.at.at - b.at.at || Number(b.confirmed) - Number(a.confirmed))[0];
}

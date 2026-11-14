import type { ErrorCode } from './codes';

/*
 * The error log (#340): the errors the Hangar Manager handled – a page it couldn't read, an entry
 * it left out – kept in this browser only, for the settings' "Error log" and for bug reports. At
 * most `ERROR_LOG_MAX` entries; a new one drops the oldest. The same error right after itself is
 * counted instead of logged again.
 */

export const ERROR_LOG_MAX = 500;
export const ERROR_LOG_VERSION = 1;

export interface ErrorLogEntry {
  /** When it happened last, in ms. */
  at: number;
  /** What went wrong and what was done instead (see `codes.ts`). */
  code: string;
  /** Short and telling, e.g. "Buy back pledge #123456: detail page HTTP 404". */
  message: string;
  /** How often it happened in a row; unset for once. */
  count?: number;
}

export interface ErrorLog {
  version: number;
  /** Oldest first. */
  entries: ErrorLogEntry[];
}

export const errorLogItem = storage.defineItem<ErrorLog | null>('local:errors.log', {
  fallback: null,
});

/** The log with `entry` added: counted if it repeats the newest one, the oldest dropped. */
export function withEntry(
  log: ErrorLog | null,
  entry: ErrorLogEntry,
  max = ERROR_LOG_MAX,
): ErrorLog {
  const entries = log?.version === ERROR_LOG_VERSION ? [...log.entries] : [];
  const last = entries.at(-1);
  if (last && last.code === entry.code && last.message === entry.message) {
    entries[entries.length - 1] = { ...last, at: entry.at, count: (last.count ?? 1) + 1 };
  } else {
    entries.push(entry);
  }
  return { version: ERROR_LOG_VERSION, entries: entries.slice(-max) };
}

// Writes one after the other, so errors logged at the same time don't overwrite each other.
let writing: Promise<void> = Promise.resolve();

/**
 * Logs a handled error. Never throws: a log that can't be written mustn't break what failed
 * already.
 */
export function logError(code: ErrorCode, message: string, at = Date.now()): Promise<void> {
  writing = writing
    .then(async () =>
      errorLogItem.setValue(withEntry(await errorLogItem.getValue(), { at, code, message })),
    )
    .catch((error: unknown) =>
      console.warn('[star-citizen-hangar-manager] Writing the error log failed', error),
    );
  return writing;
}

/**
 * The short reason of an error for a log message: the end of "<what> failed: HTTP 404" (the
 * "<what>" is said by the message itself), else the whole message.
 */
export function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return / failed: (.+)$/.exec(message)?.[1] ?? message;
}

/** Empties the log. */
export const clearErrorLog = () => errorLogItem.setValue(null);

/** Ids of pledges and orders (five digits and more), never page numbers or HTTP statuses. */
const ACCOUNT_IDS = /\d{5,}/g;

/** A message without the account's pledge and order ids, for copying and the demo mode. */
export const withoutIds = (text: string) => text.replace(ACCOUNT_IDS, '<id>');

/** "2026-11-14 14:56:29" in the browser's time zone. */
function timestamp(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** One line per entry, newest first: time, code, message and how often in a row. */
export function formatErrorLog(log: ErrorLog | null, hideIds = false): string {
  const entries = log?.version === ERROR_LOG_VERSION ? log.entries : [];
  return [...entries]
    .reverse()
    .map((entry) => {
      const message = hideIds ? withoutIds(entry.message) : entry.message;
      const count = entry.count ? ` (×${entry.count})` : '';
      return `${timestamp(entry.at)} ${entry.code} ${message}${count}`;
    })
    .join('\n');
}

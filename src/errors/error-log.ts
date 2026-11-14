import { urlOf } from '@/shared/lib/retry';
import type { ErrorCode } from './codes';

/*
 * The error log (#340): the errors the Hangar Manager handled – a page it couldn't read, an entry
 * it left out – kept in this browser only, for the settings' "Error log" and for bug reports. At
 * most `ERROR_LOG_MAX` entries; a new one drops the oldest. The same error right after itself is
 * counted instead of logged again.
 *
 * Enough to find the cause (#342): an entry keeps the URL the failed request asked for, the place
 * in the code of an unexpected error (the first lines of its stack trace) and the outline of an
 * entry of RSI's page it couldn't read. Errors that led to it – the attempts of a narrowed page
 * (#339) – are its sub-errors, kept and shown with it as one entry.
 */

export const ERROR_LOG_MAX = 500;
export const ERROR_LOG_VERSION = 1;

/** Lines of a stack trace kept: enough to find the place, not the whole way there. */
const STACK_LINES = 5;
/** The longest outline of a page's entry kept. */
export const OUTLINE_MAX = 1000;

/** What helps to find the cause of an error. */
export interface ErrorLogDetails {
  /** The full URL the failed request asked for. */
  url?: string;
  /** The first lines of the stack trace of an unexpected error, in the extension's files. */
  stack?: string[];
  /** The outline of an entry of RSI's page that couldn't be read: tags, classes, attributes. */
  outline?: string;
}

/** An error that led to a logged one, e.g. a larger page that failed before (#339). */
export interface ErrorLogSubError extends ErrorLogDetails {
  at: number;
  message: string;
}

export interface ErrorLogEntry extends ErrorLogDetails {
  /** When it happened last, in ms. */
  at: number;
  /** What went wrong and what was done instead (see `codes.ts`). */
  code: string;
  /** Short and telling, e.g. "Buy back pledge #123456: detail page HTTP 404". */
  message: string;
  /** How often it happened in a row; unset for once. */
  count?: number;
  /** The errors that led to it, in the order they happened. */
  subErrors?: ErrorLogSubError[];
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
  const repeats =
    last &&
    !last.subErrors &&
    !entry.subErrors &&
    last.code === entry.code &&
    last.message === entry.message &&
    last.url === entry.url;
  if (repeats) {
    entries[entries.length - 1] = { ...last, at: entry.at, count: (last.count ?? 1) + 1 };
  } else {
    entries.push(entry);
  }
  return { version: ERROR_LOG_VERSION, entries: entries.slice(-max) };
}

/**
 * Whether an error is a mistake of the code rather than of RSI or the connection: a `TypeError`
 * and the like that no request caused. Its stack trace shows where it happened.
 */
export function isUnexpected(error: unknown): boolean {
  if (!(error instanceof Error) || urlOf(error)) return false;
  if (!['TypeError', 'RangeError', 'ReferenceError', 'SyntaxError'].includes(error.name)) {
    return false;
  }
  // "Failed to fetch" (Chrome), "NetworkError …" (Firefox): no answer, not a mistake.
  return !/failed to fetch|networkerror|load failed/i.test(error.message);
}

/**
 * The first lines of an error's stack trace, with the files cut to the extension's own ("at
 * content-scripts/hangar.js:13:41846"): never a path of the user's computer.
 */
export function stackOf(error: unknown, lines = STACK_LINES): string[] | undefined {
  const stack = error instanceof Error ? error.stack : undefined;
  if (!stack) return undefined;
  const frames = stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^at\s|@/.test(line))
    .map((line) =>
      line
        .replace(/(?:chrome|moz|safari-web)-extension:\/\/[^/]+\//g, '')
        .replace(/(?:file|webpack):\/\/\S*?([^/\s]+\.(?:js|ts|vue))/g, '$1'),
    )
    .slice(0, lines);
  return frames.length ? frames : undefined;
}

/** What to log with an error besides code and message. */
export interface LogOptions {
  /** The error itself: its URL and, if unexpected, its stack trace are kept. */
  error?: unknown;
  url?: string;
  outline?: string;
  subErrors?: ErrorLogSubError[];
  /** Also keeps the stack trace of an expected error, e.g. for `SYNC-UNEXPECTED`. */
  withStack?: boolean;
  at?: number;
}

/** The entry of an error, with what helps to find its cause. */
export function entryOf(code: ErrorCode, message: string, options: LogOptions = {}): ErrorLogEntry {
  const { error, outline, subErrors, withStack = false, at = Date.now() } = options;
  const url = options.url ?? urlOf(error);
  const stack = withStack || isUnexpected(error) ? stackOf(error) : undefined;
  return {
    at,
    code,
    message,
    ...(url && { url }),
    ...(stack && { stack }),
    ...(outline && { outline: outline.slice(0, OUTLINE_MAX) }),
    ...(subErrors?.length && { subErrors }),
  };
}

// Writes one after the other, so errors logged at the same time don't overwrite each other.
let writing: Promise<void> = Promise.resolve();

/**
 * Logs a handled error. Never throws: a log that can't be written mustn't break what failed
 * already.
 */
export function logError(code: ErrorCode, message: string, options?: LogOptions): Promise<void> {
  const entry = entryOf(code, message, options);
  writing = writing
    .then(async () => errorLogItem.setValue(withEntry(await errorLogItem.getValue(), entry)))
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

/** `text` with a capital first letter, for a message that starts with a description. */
export const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

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

/** The details of an entry or sub-error, each on a line of its own below it. */
function detailLines(details: ErrorLogDetails, indent: string, clean: (text: string) => string) {
  return [
    ...(details.url ? [`${indent}URL: ${clean(details.url)}`] : []),
    ...(details.stack ?? []).map((frame) => `${indent}${frame}`),
    ...(details.outline
      ? [`${indent}Outline:`, ...details.outline.split('\n').map((line) => `${indent}  ${line}`)]
      : []),
  ];
}

/** Marks an entry with sub-errors: it is the one closest to the cause (#342). */
export const MAIN_MARK = '►';
/** Starts a sub-error, below its entry. */
export const SUB_MARK = '↳';

/**
 * The log as text, newest first: per entry its time, code, message and how often in a row, then
 * its URL, stack trace and outline indented below it, then its sub-errors. An entry with
 * sub-errors is marked as the one closest to the cause.
 */
export function formatErrorLog(log: ErrorLog | null, hideIds = false): string {
  const entries = log?.version === ERROR_LOG_VERSION ? log.entries : [];
  const clean = hideIds ? withoutIds : (text: string) => text;
  return [...entries]
    .reverse()
    .map((entry) => {
      const count = entry.count ? ` (×${entry.count})` : '';
      const mark = entry.subErrors?.length ? `${MAIN_MARK} ` : '';
      return [
        `${timestamp(entry.at)} ${mark}${entry.code} ${clean(entry.message)}${count}`,
        ...detailLines(entry, '    ', clean),
        ...(entry.subErrors ?? []).flatMap((sub) => [
          `  ${SUB_MARK} ${timestamp(sub.at)} ${clean(sub.message)}`,
          ...detailLines(sub, '      ', clean),
        ]),
      ].join('\n');
    })
    .join('\n');
}

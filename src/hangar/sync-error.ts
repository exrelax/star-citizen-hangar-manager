import type { SyncError } from './sync-state';

/*
 * The text "Copy details" puts on the clipboard when a sync failed (#334), for a bug report: the
 * extension's version, the browser, the part that failed and the error – in English, for the
 * maintainer. Pledge and order ids (five digits and more) are left out, so it holds no account
 * data; page numbers and HTTP statuses stay.
 */

/** Ids of pledges and orders in an error message, never page numbers or HTTP statuses. */
const ACCOUNT_IDS = /\d{5,}/g;

export function syncErrorReport(
  error: SyncError,
  context: { version: string; userAgent: string },
): string {
  return [
    `Star Citizen Hangar Manager ${context.version}`,
    context.userAgent,
    `Reading ${error.storage} failed at ${new Date(error.at).toISOString()}`,
    error.message.replace(ACCOUNT_IDS, '<id>'),
  ].join('\n');
}

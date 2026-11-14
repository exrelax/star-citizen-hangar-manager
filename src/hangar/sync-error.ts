import { withoutIds } from '@/errors/error-log';
import { reportHeader, type ReportContext } from '@/errors/report';
import type { SyncError } from './sync-state';

/*
 * The text "Copy details" puts on the clipboard when a sync failed (#334), for a bug report: the
 * extension's version, the browser, the part that failed and the error – in English, for the
 * maintainer. Pledge and order ids (five digits and more) are left out, so it holds no account
 * data; page numbers and HTTP statuses stay.
 */

export function syncErrorReport(error: SyncError, context: ReportContext): string {
  return [
    reportHeader(context),
    `${error.code}: reading ${error.storage} failed at ${new Date(error.at).toISOString()}`,
    withoutIds(error.message),
    ...(error.url ? [`URL: ${withoutIds(error.url)}`] : []),
  ].join('\n');
}

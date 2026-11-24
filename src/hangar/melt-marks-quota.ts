import { i18n } from '@/i18n';
import { MeltMarksQuotaError } from './melt-marks';

/**
 * What to say when marks don't fit into the synced storage (#658), or `undefined` for any other
 * error, which the caller throws again.
 */
export function meltMarksQuotaText(error: unknown): string | undefined {
  if (!(error instanceof MeltMarksQuotaError)) return undefined;
  return error.room === undefined
    ? i18n.t('meltMark.quotaFull')
    : i18n.n('meltMark.quotaRoom', error.room, [error.room]);
}

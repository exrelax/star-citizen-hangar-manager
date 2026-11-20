import { defineMeta } from '@/storage/meta';
import type { TokenRenewal } from './token-renewals';

/** Format version of the stored renewals; others are ignored and read again. */
export const TOKEN_RENEWALS_VERSION = 1;

export interface TokenRenewalsSnapshot {
  version: number;
  renewals: TokenRenewal[];
}

/** When RSI renews the buy back tokens (#434), from the project website, as last read. */
export const tokenRenewalsItem = storage.defineItem<TokenRenewalsSnapshot | null>(
  'local:buybackTokenRenewals',
  { fallback: null },
);

/** The stored renewals, if of the current format; else none. */
export const storedTokenRenewals = (snapshot: TokenRenewalsSnapshot | null): TokenRenewal[] =>
  snapshot?.version === TOKEN_RENEWALS_VERSION ? snapshot.renewals : [];

/** Last read, check and fingerprint of the renewals (see `storage/meta.ts`). */
export const tokenRenewalsMeta = defineMeta('local:buybackTokenRenewals');

import { BUYBACK_TOKENS } from '@/config';
import { createSiteDataSync, fetchSiteFile, type RefreshOptions } from '@/site-data/sync-site-data';
import { parseTokenRenewals, type TokenRenewal } from './token-renewals';
import {
  TOKEN_RENEWALS_VERSION,
  tokenRenewalsItem,
  tokenRenewalsMeta,
  type TokenRenewalsSnapshot,
} from './token-renewals-storage';

/*
 * Keeps the stored renewals of the buy back tokens (#434) current, like every data file of the
 * project website (`site-data/sync-site-data.ts`): at the times of `SITE_DATA.schedule`; offline
 * the stored ones stay.
 */

/**
 * The renewals of the website's file, checked. The development build reads the file of the
 * working copy (`site/public/data/buyback-tokens.json`), so dates can be tried before they go live.
 */
export async function fetchTokenRenewals(): Promise<TokenRenewal[] | undefined> {
  if (import.meta.env.DEV) {
    const local = await import('../../site/public/data/buyback-tokens.json');
    return parseTokenRenewals(local.default);
  }
  return parseTokenRenewals(await fetchSiteFile(BUYBACK_TOKENS.url));
}

const refresh = createSiteDataSync({
  name: 'Buy back token renewals',
  item: tokenRenewalsItem,
  meta: tokenRenewalsMeta,
  version: TOKEN_RENEWALS_VERSION,
  fetch: () => fetchTokenRenewals(),
  toSnapshot: (renewals: TokenRenewal[]) => ({ version: TOKEN_RENEWALS_VERSION, renewals }),
  fromSnapshot: (snapshot: TokenRenewalsSnapshot) => snapshot.renewals,
});

/** Reads the renewals if due (`force`: in any case). */
export async function maybeRefreshTokenRenewals(
  options: RefreshOptions<TokenRenewal[]> = {},
): Promise<void> {
  await refresh(options);
}

import { hashOf, recordCheck, recordSync } from '@/storage/meta';
import { fetchStoreCredit, type StoreCredit } from './store-credit';
import { storeCreditItem, storeCreditMeta, STORE_CREDIT_VERSION } from './store-credit-storage';

/*
 * Keeps the stored store credit current: one small request, with every full refresh, from the
 * settings and with every smart update (it changes when pledges are exchanged, or bought with
 * store credit). An unchanged amount is not written again.
 */

let running: Promise<void> | undefined;

export function refreshStoreCredit({
  fetchCredit = fetchStoreCredit,
  now = Date.now,
}: { fetchCredit?: () => Promise<StoreCredit>; now?: () => number } = {}): Promise<void> {
  running ??= (async () => {
    try {
      const credit = await fetchCredit();
      const [stored, meta] = await Promise.all([
        storeCreditItem.getValue(),
        storeCreditMeta.getValue(),
      ]);
      const value = { version: STORE_CREDIT_VERSION, credit };
      const fingerprint = hashOf(value);
      const unchanged =
        stored?.version === STORE_CREDIT_VERSION && meta.fingerprint === fingerprint;
      if (!unchanged) await storeCreditItem.setValue(value);
      await recordSync(storeCreditMeta, {
        at: now(),
        fingerprint,
        ...(unchanged && { updatedAt: meta.updatedAt }),
      });
    } catch (error) {
      console.warn('[star-citizen-hangar-manager] Store credit unavailable', error);
      await recordCheck(storeCreditMeta, { status: 'failed' }, { at: now() });
    }
  })().finally(() => (running = undefined));
  return running;
}

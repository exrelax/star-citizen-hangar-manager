import { BUYBACK_SNAPSHOT_VERSION, type BuybackSnapshot } from '@/buyback/buyback';
import { buybackMeta, buybackSnapshot } from '@/buyback/buyback-storage';
import { giftFlagsItem, type GiftFlags } from '@/buyback/gift-flags';
import { hangarMeta, hangarSnapshot } from '@/hangar/hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot } from '@/hangar/pledge';
import { ORDERS_SNAPSHOT_VERSION, type OrdersSnapshot } from '@/orders/orders';
import { ordersMeta, ordersSnapshot } from '@/orders/orders-storage';
import {
  STORE_CREDIT_VERSION,
  storeCreditItem,
  type StoreCreditSnapshot,
} from '@/account/store-credit-storage';
import { EMPTY_META, type MetaItem } from '@/storage/meta';
import type { ExportFile } from './export-file';
import { loadHangarData, type HangarData } from './hangar-export';

/*
 * The hangar import (#231): a hangar export of the own format (#226) restores the stored hangar,
 * e.g. in a new browser, so the first full load can be skipped; the smart updates bring it up to
 * date afterwards. Decided over a read-only view: the file already holds everything the manager
 * shows, and restoring it is what saves the user time. So:
 * - only a whole file: not one of the pledges shown in My Hangar, and not one without the ids or
 *   the amounts – it isn't the account any more;
 * - only for the same account: with a hangar stored here, the file must share pledges with it;
 * - data stored here that is newer than the file's (its last full read) wins, a snapshot of
 *   another format is left out (it is read again), the store credit only fills a gap;
 * - the gift flags of melted pledges are merged by pledge id, a flag of this browser wins.
 */

export type HangarImportRefusal = 'partial' | 'demo' | 'redacted' | 'otherAccount' | 'empty';

/** What the import writes, by storage. */
export interface HangarImport {
  hangar?: HangarSnapshot;
  buyback?: BuybackSnapshot;
  orders?: OrdersSnapshot;
  storeCredit?: StoreCreditSnapshot;
  giftFlags?: GiftFlags;
}

const time = (iso: string | undefined) => (iso ? Date.parse(iso) || 0 : 0);

/** A snapshot of the file of the current format, if it is newer than the one stored here. */
function newer<T extends { version: number; syncedAt: string }>(
  value: unknown,
  version: number,
  here: T | null,
): T | undefined {
  const file = value as T | undefined;
  if (file?.version !== version || typeof file.syncedAt !== 'string') return undefined;
  if (here?.version === version && time(here.syncedAt) >= time(file.syncedAt)) return undefined;
  return file;
}

const idsOf = (data: Pick<HangarData, 'hangar' | 'buyback'>) =>
  new Set([...(data.hangar?.pledges ?? []), ...(data.buyback?.pledges ?? [])].map((p) => p.id));

/** What a hangar file would restore here, or why it can't. */
export function hangarImportOf(
  file: ExportFile,
  here: HangarData,
): { ok: true; writes: HangarImport } | { ok: false; refusal: HangarImportRefusal } {
  if (file.partial) return { ok: false, refusal: 'partial' };
  if (file.demo) return { ok: false, refusal: 'demo' };
  if (file.redacted?.length) return { ok: false, refusal: 'redacted' };
  const value = <T>(id: keyof HangarImport) => file.storages[id]?.value as T | undefined;
  const fileIds = idsOf({
    hangar: value<HangarSnapshot>('hangar') ?? null,
    buyback: value<BuybackSnapshot>('buyback') ?? null,
  });
  const hereIds = idsOf(here);
  if (fileIds.size && hereIds.size && ![...fileIds].some((id) => hereIds.has(id))) {
    return { ok: false, refusal: 'otherAccount' };
  }

  const writes: HangarImport = {};
  const hangar = newer(value('hangar'), HANGAR_SNAPSHOT_VERSION, here.hangar);
  if (hangar && Array.isArray(hangar.pledges)) writes.hangar = hangar;
  const buyback = newer(value('buyback'), BUYBACK_SNAPSHOT_VERSION, here.buyback);
  if (buyback && Array.isArray(buyback.pledges)) writes.buyback = buyback;
  const orders = newer(value('orders'), ORDERS_SNAPSHOT_VERSION, here.orders);
  if (orders && typeof orders.pledgeOrders === 'object' && typeof orders.orders === 'object') {
    writes.orders = orders;
  }
  const credit = value<StoreCreditSnapshot>('storeCredit');
  if (
    !here.storeCredit &&
    credit?.version === STORE_CREDIT_VERSION &&
    typeof credit.credit?.amount === 'number'
  ) {
    writes.storeCredit = credit;
  }
  const flags = value<Record<string, unknown>>('giftFlags');
  if (flags && typeof flags === 'object') {
    const fromFile = Object.fromEntries(
      Object.entries(flags).filter(
        ([id, flag]) =>
          /^\d+$/.test(id) && typeof flag === 'boolean' && !(id in (here.giftFlags ?? {})),
      ),
    ) as GiftFlags;
    if (Object.keys(fromFile).length) writes.giftFlags = { ...fromFile, ...here.giftFlags };
  }
  if (!Object.keys(writes).length) return { ok: false, refusal: 'empty' };
  return { ok: true, writes };
}

/** The metadata of restored data: read in full then, not checked here yet. */
const restoredMeta = (item: MetaItem, snapshot: { syncedAt: string; updatedAt?: string }) =>
  item.setValue({
    ...EMPTY_META,
    syncedAt: time(snapshot.syncedAt),
    updatedAt: time(snapshot.updatedAt ?? snapshot.syncedAt),
  });

/** Restores what `hangarImportOf` found, with the metadata of each snapshot. */
export async function writeHangarImport(writes: HangarImport): Promise<void> {
  if (writes.hangar) {
    await hangarSnapshot.setValue(writes.hangar);
    await restoredMeta(hangarMeta, writes.hangar);
  }
  if (writes.buyback) {
    await buybackSnapshot.setValue(writes.buyback);
    await restoredMeta(buybackMeta, writes.buyback);
  }
  if (writes.orders) {
    await ordersSnapshot.setValue(writes.orders);
    await restoredMeta(ordersMeta, writes.orders);
  }
  if (writes.storeCredit) await storeCreditItem.setValue(writes.storeCredit);
  if (writes.giftFlags) await giftFlagsItem.setValue(writes.giftFlags);
}

/** Reads the stored data and restores the file's, unless it is refused. */
export async function importHangar(file: ExportFile) {
  const result = hangarImportOf(file, await loadHangarData());
  if (result.ok) await writeHangarImport(result.writes);
  return result;
}

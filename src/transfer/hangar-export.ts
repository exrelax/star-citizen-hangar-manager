import { buybackSnapshot } from '@/buyback/buyback-storage';
import type { BuybackSnapshot } from '@/buyback/buyback';
import { giftFlagsItem, type GiftFlags } from '@/buyback/gift-flags';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import type { HangarSnapshot } from '@/hangar/pledge';
import { ordersSnapshot } from '@/orders/orders-storage';
import type { OrdersSnapshot } from '@/orders/orders';
import { storeCreditItem, type StoreCreditSnapshot } from '@/account/store-credit-storage';
import { exported, exportFile, type ExportFile } from './export-file';

/*
 * The hangar export in the Hangar Manager's own format (#226): the account's data – the hangar,
 * the buy back, the orders, the store credit – and the gift flags of melted pledges, which can't
 * be read again from RSI (#204). From My Hangar only the pledges shown, from the settings
 * everything. It can leave out what is sensitive, like the settings' "Privacy" section hides it:
 * the ids, or the amounts. A file without them can't restore the hangar (#231).
 */

/** The account's data, as the registry items give it. */
export interface HangarData {
  hangar: HangarSnapshot | null;
  buyback: BuybackSnapshot | null;
  orders: OrdersSnapshot | null;
  storeCredit: StoreCreditSnapshot | null;
  giftFlags: GiftFlags | null;
}

export interface HangarExportOptions {
  /** Only these pledges of the hangar (those shown in My Hangar); no buy back then. */
  pledgeIds?: ReadonlySet<number>;
  /** Leave out the pledge and order ids: pledges are numbered instead. */
  hideIds?: boolean;
  /** Leave out the amounts: values, prices, orders and the store credit. */
  hideAmounts?: boolean;
}

export async function loadHangarData(): Promise<HangarData> {
  const [hangar, buyback, orders, storeCredit, giftFlags] = await Promise.all([
    hangarSnapshot.getValue(),
    buybackSnapshot.getValue(),
    ordersSnapshot.getValue(),
    storeCreditItem.getValue(),
    giftFlagsItem.getValue(),
  ]);
  return { hangar, buyback, orders, storeCredit, giftFlags };
}

/** The file of the hangar export. */
export function buildHangarExport(
  data: HangarData,
  options: HangarExportOptions = {},
  now = new Date(),
  version?: string,
): ExportFile {
  const { pledgeIds, hideIds = false, hideAmounts = false } = options;
  const partial = pledgeIds !== undefined;
  const keep = (id: number) => !pledgeIds || pledgeIds.has(id);

  let hangar = data.hangar && {
    ...data.hangar,
    pledges: data.hangar.pledges.filter((p) => keep(p.id)),
  };
  let buyback = partial ? null : data.buyback;
  let orders =
    data.orders && partial
      ? ordersOf(data.orders, hangar?.pledges.map((p) => p.id) ?? [])
      : data.orders;
  let giftFlags = partial ? null : data.giftFlags;
  let storeCredit = partial ? null : data.storeCredit;

  if (hideAmounts) {
    hangar = hangar && {
      ...hangar,
      pledges: hangar.pledges.map((pledge) => ({
        ...pledge,
        value: '',
        valueUsd: 0,
        configurationValue: '',
      })),
    };
    buyback = buyback && {
      ...buyback,
      pledges: buyback.pledges.map((pledge) => {
        const copy = { ...pledge };
        delete copy.price;
        return copy;
      }),
    };
    orders = null;
    storeCredit = null;
  }
  if (hideIds) {
    // The orders and the gift flags only work by the ids.
    orders = null;
    giftFlags = null;
    hangar = hangar && {
      ...hangar,
      pledges: hangar.pledges.map((pledge, index) => ({ ...pledge, id: index + 1 })),
    };
    buyback = buyback && {
      ...buyback,
      pledges: buyback.pledges.map((pledge, index) => ({ ...pledge, id: index + 1 })),
    };
  }

  const storages = Object.fromEntries(
    Object.entries({ hangar, buyback, orders, storeCredit, giftFlags })
      .map(([id, value]) => [id, exported(value)] as const)
      .filter(([, entry]) => entry),
  );
  const redacted = [
    ...(hideIds ? (['ids'] as const) : []),
    ...(hideAmounts ? (['amounts'] as const) : []),
  ];
  return exportFile('hangar', storages, { redacted, partial }, now, version);
}

/** The orders of these pledges only, without the pledge log entries of the others. */
function ordersOf(orders: OrdersSnapshot, ids: readonly number[]): OrdersSnapshot {
  const pledgeOrders = Object.fromEntries(
    ids.filter((id) => orders.pledgeOrders[id]).map((id) => [id, orders.pledgeOrders[id]!]),
  );
  const used = new Set(Object.values(pledgeOrders).map((order) => order.orderId));
  return {
    ...orders,
    pledgeOrders,
    orders: Object.fromEntries(Object.entries(orders.orders).filter(([id]) => used.has(id))),
    recentLogEntries: [],
  };
}

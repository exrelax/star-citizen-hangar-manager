import type { BuybackSnapshot } from '@/buyback/buyback';
import { bestInsurance, type Insurance } from '@/hangar/insurance';
import type { HangarSnapshot, Pledge } from '@/hangar/pledge';
import type { OrdersSnapshot } from '@/orders/orders';
import { toCsv, type CsvCell } from './csv';
import type { ExportFile } from './export-file';

/*
 * The hangar export as CSV for spreadsheets (#227): one row per pledge with its items in one
 * column, and the buy back as a file of its own. Made from the JSON export's file (#226), so the
 * choice of pledges and the left-out ids and amounts are the same. The store credits stay in the
 * JSON: a line above the table would break the header row the spreadsheets sort and filter by.
 */

/** "LTI" or "120 months", in English like the column names. */
export const insuranceText = (insurance: Insurance | undefined): string =>
  !insurance ? '' : insurance.lifetime ? 'LTI' : `${insurance.months} months`;

const value = <T>(file: ExportFile, id: keyof ExportFile['storages']) =>
  file.storages[id]?.value as T | undefined;

export const HANGAR_CSV_HEADER = [
  'ID',
  'Name',
  'Items',
  'Insurance',
  'Value (USD)',
  'Giftable',
  'Meltable',
  'Upgraded',
  'Bought on',
  'Order',
  'Paid',
] as const;

/** The pledges of the hangar, one row each. */
export function hangarCsv(file: ExportFile): string {
  const hangar = value<HangarSnapshot>(file, 'hangar');
  const orders = value<OrdersSnapshot>(file, 'orders');
  const amounts = !file.redacted?.includes('amounts');
  const rows = (hangar?.pledges ?? []).map((pledge: Pledge): CsvCell[] => {
    const link = orders?.pledgeOrders[pledge.id];
    const order = link && orders?.orders[link.orderId];
    const titles = pledge.items.map((item) => item.title);
    return [
      pledge.id,
      pledge.name,
      titles.join('; '),
      insuranceText(bestInsurance(titles)),
      amounts ? pledge.valueUsd : '',
      pledge.isGiftable,
      pledge.isExchangeable,
      pledge.isUpgraded,
      pledge.createdAt,
      link?.orderId,
      order?.amount,
    ];
  });
  return toCsv(HANGAR_CSV_HEADER, rows);
}

export const BUYBACK_CSV_HEADER = ['ID', 'Name', 'Items', 'Melted on', 'Buy back price (USD)'];

/** The buy back, one row per melted pledge; `undefined` without one in the file. */
export function buybackCsv(file: ExportFile): string | undefined {
  const buyback = value<BuybackSnapshot>(file, 'buyback');
  if (!buyback) return undefined;
  const rows = buyback.pledges.map((pledge): CsvCell[] => [
    pledge.id,
    pledge.title,
    (pledge.items ?? []).join('; ') || pledge.contained,
    pledge.reclaimedAt,
    pledge.price,
  ]);
  return toCsv(BUYBACK_CSV_HEADER, rows);
}

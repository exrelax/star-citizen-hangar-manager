import { describe, expect, it } from 'vitest';
import type { BuybackSnapshot } from '@/buyback/buyback';
import type { HangarSnapshot, Pledge } from '@/hangar/pledge';
import type { OrdersSnapshot } from '@/orders/orders';
import { BOM, csvCell, toCsv } from './csv';
import { exportFile } from './export-file';
import { buybackCsv, hangarCsv } from './hangar-csv';
import { buildHangarExport } from './hangar-export';

/* The hangar export as CSV (#227). */

const NOW = new Date('2026-11-23T12:00:00Z');

const pledge = (extra: Partial<Pledge>) =>
  ({
    id: 101,
    name: 'Standalone Ships - Cutlass Black',
    valueUsd: 115,
    isGiftable: true,
    isExchangeable: true,
    isUpgraded: true,
    createdAt: '2026-03-14',
    items: [
      { title: 'Cutlass Black' },
      { title: '120 Month Insurance' },
      { title: 'Lifetime Insurance' },
    ],
    ...extra,
  }) as Pledge;

const hangar = { version: 3, syncedAt: '', pledges: [pledge({})] } as HangarSnapshot;
const orders = {
  version: 2,
  syncedAt: '',
  pledgeOrders: { 101: { orderId: 'AAA', buyback: false } },
  orders: { AAA: { id: 'AAA', amount: '€104.50 EUR' } },
  recentLogEntries: [],
} as unknown as OrdersSnapshot;
const buyback = {
  version: 1,
  syncedAt: '',
  pledges: [
    { id: 90, title: 'Upgrade - Carrack to Perseus', contained: 'Perseus', price: 200 },
    { id: 91, title: 'Paint', contained: 'Paint', items: ['Ghoulish Green', 'Decal'] },
  ],
} as BuybackSnapshot;

const file = (options = {}) =>
  buildHangarExport(
    { hangar, buyback, orders, storeCredit: null, giftFlags: null },
    options,
    NOW,
    '1',
  );
const lines = (csv: string) => csv.slice(BOM.length).trimEnd().split('\r\n');

describe('csvCell', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('one\ntwo')).toBe('"one\ntwo"');
    expect(csvCell('plain')).toBe('plain');
  });

  it('defuses formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tx')).toBe("'\tx");
  });

  it('keeps numbers, writes yes and no, leaves missing cells empty', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(true)).toBe('yes');
    expect(csvCell(false)).toBe('no');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(null)).toBe('');
  });

  it('starts with a BOM and ends lines with CRLF', () => {
    expect(toCsv(['A', 'B'], [['ä', 1]])).toBe(`${BOM}A,B\r\nä,1\r\n`);
  });
});

describe('hangarCsv', () => {
  it('writes a row per pledge with its items in one column', () => {
    expect(lines(hangarCsv(file()))).toEqual([
      'ID,Name,Items,Insurance,Value (USD),Giftable,Meltable,Upgraded,Bought on,Order,Paid',
      '101,Standalone Ships - Cutlass Black,Cutlass Black; 120 Month Insurance; Lifetime Insurance,LTI,115,yes,yes,yes,2026-03-14,AAA,€104.50 EUR',
    ]);
  });

  it('leaves out what the JSON export leaves out', () => {
    const [, row] = lines(hangarCsv(file({ hideIds: true, hideAmounts: true })));
    expect(row).toBe(
      '1,Standalone Ships - Cutlass Black,Cutlass Black; 120 Month Insurance; Lifetime Insurance,LTI,,yes,yes,yes,2026-03-14,,',
    );
  });

  it('writes only the header without a hangar', () => {
    expect(lines(hangarCsv(exportFile('hangar', {}, {}, NOW, '1')))).toHaveLength(1);
  });
});

describe('buybackCsv', () => {
  it('is a file of its own with a row per melted pledge', () => {
    expect(lines(buybackCsv(file())!)).toEqual([
      'ID,Name,Items,Melted on,Buy back price (USD)',
      '90,Upgrade - Carrack to Perseus,Perseus,,200',
      '91,Paint,Ghoulish Green; Decal,,',
    ]);
  });

  it('is missing without a buy back, as from My Hangar', () => {
    expect(buybackCsv(file({ pledgeIds: new Set([101]) }))).toBeUndefined();
  });
});

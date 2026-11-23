import { describe, expect, it } from 'vitest';
import type { BuybackPledge, BuybackSnapshot } from '@/buyback/buyback';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot, type Pledge } from '@/hangar/pledge';
import type { OrdersSnapshot } from '@/orders/orders';
import { EXPORT_FORMAT, EXPORT_SCHEMA_VERSION, exportFileName, versionOf } from './export-file';
import { buildHangarExport, type HangarData } from './hangar-export';

/* The hangar export in the own JSON format (#226). */

const pledge = (id: number, valueUsd: number) =>
  ({
    id,
    name: valueUsd > 100 ? 'Polaris' : 'Aurora',
    value: `$${valueUsd}.00 USD`,
    valueUsd,
    items: [],
  }) as unknown as Pledge;
const melted = (id: number, price: number) =>
  ({ id, title: 'Cutlass Black', price }) as unknown as BuybackPledge;

const data = (): HangarData => ({
  hangar: {
    version: HANGAR_SNAPSHOT_VERSION,
    syncedAt: '2026-11-20T10:00:00Z',
    pledges: [pledge(101, 45), pledge(102, 270)],
  } as HangarSnapshot,
  buyback: {
    version: 1,
    syncedAt: '2026-11-20T10:00:00Z',
    pledges: [melted(90, 30)],
  } as BuybackSnapshot,
  orders: {
    version: 2,
    syncedAt: '2026-11-20T10:00:00Z',
    pledgeOrders: {
      101: { orderId: 'AAA', buyback: false },
      102: { orderId: 'BBB', buyback: false },
    },
    orders: { AAA: { id: 'AAA', amount: '$45.00 USD' }, BBB: { id: 'BBB', amount: '$0.00 USD' } },
    recentLogEntries: ['log'],
  } as OrdersSnapshot,
  storeCredit: { version: 1, credit: { amount: 233.96, currency: 'USD' } },
  giftFlags: { 90: true },
});

const NOW = new Date('2026-11-23T12:00:00Z');

describe('buildHangarExport', () => {
  it('holds the account data and the gift flags with their versions', () => {
    const file = buildHangarExport(data(), {}, NOW, '1.2.0');
    expect(file).toMatchObject({
      format: EXPORT_FORMAT,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      kind: 'hangar',
      exportedAt: '2026-11-23T12:00:00.000Z',
      extensionVersion: '1.2.0',
    });
    expect(file.partial).toBeUndefined();
    expect(file.redacted).toBeUndefined();
    expect(Object.keys(file.storages)).toEqual([
      'hangar',
      'buyback',
      'orders',
      'storeCredit',
      'giftFlags',
    ]);
    expect(file.storages.hangar?.version).toBe(HANGAR_SNAPSHOT_VERSION);
    expect(file.storages.orders?.version).toBe(2);
    expect(file.storages.giftFlags).toEqual({ version: 1, value: { 90: true } });
  });

  it('leaves out what is not stored', () => {
    const file = buildHangarExport({ ...data(), buyback: null, giftFlags: null }, {}, NOW, '1');
    expect(Object.keys(file.storages)).toEqual(['hangar', 'orders', 'storeCredit']);
  });

  it('holds only the pledges shown and their orders, from My Hangar', () => {
    const file = buildHangarExport(data(), { pledgeIds: new Set([102]) }, NOW, '1');
    expect(file.partial).toBe(true);
    const hangar = file.storages.hangar?.value as HangarSnapshot;
    expect(hangar.pledges.map((p) => p.id)).toEqual([102]);
    const orders = file.storages.orders?.value as OrdersSnapshot;
    expect(Object.keys(orders.pledgeOrders)).toEqual(['102']);
    expect(Object.keys(orders.orders)).toEqual(['BBB']);
    expect(orders.recentLogEntries).toEqual([]);
    expect(Object.keys(file.storages)).toEqual(['hangar', 'orders']);
  });

  it('leaves out the ids on request', () => {
    const file = buildHangarExport(data(), { hideIds: true }, NOW, '1');
    expect(file.redacted).toEqual(['ids']);
    const hangar = file.storages.hangar?.value as HangarSnapshot;
    expect(hangar.pledges.map((p) => p.id)).toEqual([1, 2]);
    const buyback = file.storages.buyback?.value as BuybackSnapshot;
    expect(buyback.pledges.map((p) => p.id)).toEqual([1]);
    expect(file.storages.orders).toBeUndefined();
    expect(file.storages.giftFlags).toBeUndefined();
    expect(JSON.stringify(file)).not.toMatch(/101|102|AAA|BBB/);
  });

  it('leaves out the amounts on request', () => {
    const file = buildHangarExport(data(), { hideAmounts: true }, NOW, '1');
    expect(file.redacted).toEqual(['amounts']);
    const pledges = (file.storages.hangar?.value as HangarSnapshot).pledges;
    expect(pledges.every((p) => p.valueUsd === 0 && p.value === '')).toBe(true);
    const buyback = file.storages.buyback?.value as BuybackSnapshot;
    expect(buyback.pledges[0]).not.toHaveProperty('price');
    expect(file.storages.orders).toBeUndefined();
    expect(file.storages.storeCredit).toBeUndefined();
    expect(JSON.stringify(file)).not.toMatch(/233\.96|\$45|\$270/);
  });

  it('never changes the stored data', () => {
    const before = data();
    const copy = structuredClone(before);
    buildHangarExport(before, { hideIds: true, hideAmounts: true }, NOW, '1');
    expect(before).toEqual(copy);
  });
});

describe('the file', () => {
  it('names the version of a stored value, the first format without one', () => {
    expect(versionOf({ version: 3 })).toBe(3);
    expect(versionOf({ 1: true })).toBe(1);
    expect(versionOf([])).toBe(1);
  });

  it('is named by its kind and day', () => {
    expect(exportFileName('hangar', 'json', new Date(2026, 10, 3))).toBe(
      'hangar-manager-hangar-2026-11-03.json',
    );
  });
});

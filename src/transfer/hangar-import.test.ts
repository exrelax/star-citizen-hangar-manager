import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { BuybackSnapshot } from '@/buyback/buyback';
import { giftFlagsItem } from '@/buyback/gift-flags';
import { hangarMeta, hangarSnapshot } from '@/hangar/hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot, type Pledge } from '@/hangar/pledge';
import { storeCreditItem } from '@/account/store-credit-storage';
import { buildHangarExport, type HangarData } from './hangar-export';
import { readExportFile } from './import-file';
import { hangarImportOf, importHangar } from './hangar-import';

/* The hangar import: restoring a hangar export (#231). */

beforeEach(() => fakeBrowser.reset());

const NOW = new Date('2026-11-23T12:00:00Z');

const hangar = (ids: number[], syncedAt: string): HangarSnapshot => ({
  version: HANGAR_SNAPSHOT_VERSION,
  syncedAt,
  pledges: ids.map((id) => ({ id, name: 'Cutlass Black', items: [] }) as unknown as Pledge),
});
const buyback = (ids: number[]): BuybackSnapshot => ({
  version: 1,
  syncedAt: '2026-11-20T10:00:00Z',
  pledges: ids.map((id) => ({ id, title: 'Paint', contained: '', isUpgrade: false })),
});

const empty: HangarData = {
  hangar: null,
  buyback: null,
  orders: null,
  storeCredit: null,
  giftFlags: null,
};

const exported: HangarData = {
  hangar: hangar([1, 2], '2026-11-20T10:00:00Z'),
  buyback: buyback([9]),
  orders: null,
  storeCredit: { version: 1, credit: { amount: 12.5, currency: 'USD' } },
  giftFlags: { 9: true, 8: false },
};

const file = (options = {}) => buildHangarExport(exported, options, NOW, '1');

describe('hangarImportOf', () => {
  it('restores everything into an empty browser', () => {
    const result = hangarImportOf(file(), empty);
    expect(result.ok && Object.keys(result.writes)).toEqual([
      'hangar',
      'buyback',
      'storeCredit',
      'giftFlags',
    ]);
  });

  it('refuses a file of the pledges shown or without ids or amounts', () => {
    expect(hangarImportOf(file({ pledgeIds: new Set([1]) }), empty)).toEqual({
      ok: false,
      refusal: 'partial',
    });
    expect(hangarImportOf(file({ hideIds: true }), empty)).toEqual({
      ok: false,
      refusal: 'redacted',
    });
    expect(hangarImportOf(file({ hideAmounts: true }), empty)).toEqual({
      ok: false,
      refusal: 'redacted',
    });
  });

  it('never overwrites the data of another account', () => {
    const here = { ...empty, hangar: hangar([50, 51], '2026-11-01T00:00:00Z') };
    expect(hangarImportOf(file(), here)).toEqual({ ok: false, refusal: 'otherAccount' });
  });

  it('keeps data here that is newer, and the store credit here', () => {
    const here: HangarData = {
      ...empty,
      hangar: hangar([1, 2, 3], '2026-11-22T00:00:00Z'),
      storeCredit: { version: 1, credit: { amount: 99, currency: 'USD' } },
      giftFlags: { 9: false },
    };
    const result = hangarImportOf(file(), here);
    expect(result.ok && result.writes).toEqual({
      buyback: exported.buyback,
      // A flag of this browser wins.
      giftFlags: { 8: false, 9: false },
    });
  });

  it('takes an older hangar here as the file’s', () => {
    const here = { ...empty, hangar: hangar([1], '2026-11-01T00:00:00Z') };
    const result = hangarImportOf(file(), here);
    expect(result.ok && result.writes.hangar).toEqual(exported.hangar);
  });

  it('leaves out a snapshot of another format', () => {
    const old = buildHangarExport(
      { ...exported, hangar: { ...exported.hangar!, version: 1 } },
      {},
      NOW,
      '1',
    );
    const result = hangarImportOf(old, empty);
    expect(result.ok && result.writes.hangar).toBeUndefined();
  });

  it('says when there is nothing to restore', () => {
    expect(hangarImportOf(file(), exported)).toEqual({ ok: false, refusal: 'empty' });
  });
});

describe('importHangar', () => {
  it('restores the stored data with its metadata', async () => {
    const read = readExportFile(JSON.stringify(file()), 'hangar');
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    await importHangar(read.file);
    expect(await hangarSnapshot.getValue()).toEqual(exported.hangar);
    expect(await hangarMeta.getValue()).toMatchObject({
      syncedAt: Date.parse('2026-11-20T10:00:00Z'),
      checkedAt: 0,
    });
    expect(await storeCreditItem.getValue()).toEqual(exported.storeCredit);
    expect(await giftFlagsItem.getValue()).toEqual({ 8: false, 9: true });
  });
});

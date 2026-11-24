import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS } from '@/settings/settings';
import {
  bytesOf,
  loadWatchlists,
  saveWatchlist,
  SYNC_QUOTA,
} from '@/watchlists/watchlists-storage';
import {
  completedIdOf,
  encodeCompleted,
  loadCompleted,
} from '@/store/paint-consultant/synced-plans';
import type { CompletedPaintPlan } from '@/store/paint-consultant/completed-plans';
import type { Watchlist } from '@/watchlists/watchlists';
import { buildSettingsExport } from './settings-export';
import { importedValue, readExportFile } from './import-file';
import { valuesToWrite } from './merge';
import {
  currentValues,
  importPreview,
  ImportQuotaError,
  settingsImportOf,
  syncedImport,
  writeSettingsImport,
} from './settings-import';

/* The import of settings and your data (#230). */

beforeEach(() => fakeBrowser.reset());

const NOW = new Date('2026-11-23T12:00:00Z');

const list = (id: string, extra: Partial<Watchlist> = {}): Watchlist => ({
  id,
  name: `List ${id}`,
  description: '',
  reminder: false,
  storeAlerts: false,
  items: [
    { kind: 'storePaint', skuId: 7, name: 'Ghoulish Green', addedAt: 1_700_000_000_000, count: 1 },
  ],
  createdAt: 1_700_000_000_000,
  changedAt: 1_700_000_000_000,
  ...extra,
});

const exported = () =>
  buildSettingsExport(
    {
      settings: { theme: 'rsi', compactView: true },
      dismissedPaints: [5, 'x'],
      riskNoteSeen: true,
      notifications: [{ id: 'fillers:1', text: 'Melt', at: 1 }, { id: 2 }],
      meltMarks: { 101: 1_700_000_000_000, abc: 1, 102: 'later' },
      watchlists: [list('a'), list('b'), { id: '', name: 'broken' }],
      paintPlan: null,
    },
    undefined,
    NOW,
    '1.2.0',
  );

const text = (file: unknown) => JSON.stringify(file);

describe('readExportFile', () => {
  it('reads a file of the export', () => {
    const read = readExportFile(text(exported()), 'settings');
    expect(read.ok && read.ignored).toEqual([]);
  });

  it('tells what is wrong with a file', () => {
    expect(readExportFile('{', 'settings')).toEqual({ ok: false, error: 'json' });
    expect(readExportFile('{"format":"other","storages":{}}', 'settings')).toEqual({
      ok: false,
      error: 'format',
    });
    expect(readExportFile(text({ ...exported(), schemaVersion: 99 }), 'settings')).toEqual({
      ok: false,
      error: 'schema',
    });
    expect(readExportFile(text(exported()), 'hangar')).toEqual({ ok: false, error: 'kind' });
  });

  it('ignores storages it does not know, and says so', () => {
    const file = exported();
    const read = readExportFile(
      text({ ...file, storages: { ...file.storages, later: { version: 1, value: 1 } } }),
      'settings',
    );
    expect(read.ok && read.ignored).toEqual(['later']);
  });
});

describe('importedValue', () => {
  it('completes the settings with their defaults', () => {
    expect(importedValue('settings', { theme: 'rsi', fontSize: 'huge' })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'rsi',
    });
  });

  it('keeps only what can be read', () => {
    expect(importedValue('dismissedPaints', [5, 'x'])).toEqual([5]);
    expect(importedValue('meltMarks', { 101: 1, abc: 1, 102: 'later' })).toEqual({ 101: 1 });
    expect(importedValue('riskNoteSeen', 'yes')).toBeUndefined();
    expect(importedValue('warbondHistory', { version: 99, sightings: [] })).toBeUndefined();
    expect(importedValue('paintPlan', { version: 7 })).toBeUndefined();
    expect(importedValue('paintPlan', null)).toBeNull();
  });

  it('reads the watchlists as the synced storage reads them back', () => {
    const lists = importedValue('watchlists', [list('a'), list('a'), { id: '' }]) as Watchlist[];
    expect(lists.map((entry) => entry.id)).toEqual(['a']);
    expect(lists[0]).toEqual(list('a'));
  });
});

describe('settingsImportOf', () => {
  it('takes what can be read and names the rest', () => {
    const file = exported();
    file.storages.riskNoteSeen = { version: 1, value: 'yes' };
    const { parts, values, invalid } = settingsImportOf(file);
    expect(parts).toEqual(['settings', 'yourData']);
    expect(invalid).toEqual(['riskNoteSeen']);
    expect(values.dismissedPaints).toEqual([5]);
    expect((values.watchlists as Watchlist[]).map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('takes only the parts chosen and in the file', () => {
    expect(Object.keys(settingsImportOf(exported(), ['settings']).values)).not.toContain(
      'watchlists',
    );
    const onlyYours = buildSettingsExport({ meltMarks: {} }, ['yourData'], NOW, '1');
    expect(settingsImportOf(onlyYours).parts).toEqual(['yourData']);
  });

  it('shows how many entries are here and in the file', () => {
    const { values } = settingsImportOf(exported());
    const rows = importPreview(values, { watchlists: [list('x')], meltMarks: {} });
    expect(rows.find((row) => row.id === 'watchlists')).toEqual({
      id: 'watchlists',
      here: 1,
      file: 2,
    });
    expect(rows.find((row) => row.id === 'meltMarks')).toEqual({
      id: 'meltMarks',
      here: 0,
      file: 1,
    });
  });
});

describe('syncedImport', () => {
  it('replaces the watchlists and keeps everything else', () => {
    const placed = syncedImport(
      { 'watchlist.old': {}, watchlists: { v: 1, ids: ['old'] }, other: 1 },
      { watchlists: [list('a')], riskNoteSeen: true },
    );
    expect('writes' in placed && Object.keys(placed.writes).sort()).toEqual(
      ['accountSafety.riskNoteSeen', 'watchlist.a', 'watchlists'].sort(),
    );
    expect('removed' in placed && placed.removed).toEqual(['watchlist.old']);
  });

  it('names a storage whose key would be too big', () => {
    const marks = Object.fromEntries(
      Array.from({ length: 800 }, (_, index) => [100_000 + index, 1_700_000_000_000]),
    );
    expect(syncedImport({}, { meltMarks: marks })).toEqual({
      storage: 'meltMarks',
      limit: 'perItem',
    });
  });

  it('names the total when everything together wouldn’t fit', () => {
    const big = { other: 'x'.repeat(SYNC_QUOTA.total - 150) };
    expect(syncedImport(big, { watchlists: [list('a'), list('b')] })).toEqual({ limit: 'total' });
  });

  it('lets completed plans give way', () => {
    const big = { 'consultant.done.1': 'x'.repeat(SYNC_QUOTA.total - 30) };
    const placed = syncedImport(big, { riskNoteSeen: true });
    expect('gaveWay' in placed && placed.gaveWay).toEqual(['consultant.done.1']);
  });

  it('keeps the completed plans where everything fits', () => {
    const placed = syncedImport({ 'consultant.done.1': 'x' }, { riskNoteSeen: true });
    expect('gaveWay' in placed && placed.gaveWay).toEqual([]);
  });

  it('keeps this browser’s choice of bulk melting, and takes its limit', () => {
    const settings = { ...DEFAULT_SETTINGS, bulkMelting: true, bulkMeltingMax: 20 };
    const off = syncedImport({ settings: { bulkMelting: false } }, { settings });
    expect('writes' in off && off.writes.settings).toMatchObject({
      bulkMelting: false,
      bulkMeltingMax: 20,
    });
    const none = syncedImport({}, { settings });
    expect('writes' in none && none.writes.settings).toMatchObject({ bulkMelting: false });
    const on = syncedImport(
      { settings: { bulkMelting: true } },
      { settings: { ...settings, bulkMelting: false } },
    );
    expect('writes' in on && on.writes.settings).toMatchObject({ bulkMelting: true });
  });
});

/** A completed plan of about 7 KB in the synced storage. */
const completed = (index: number): CompletedPaintPlan => ({
  way: 'buy',
  startedAt: 1_700_000_000_000 + index,
  completedAt: 1_700_000_100_000 + index,
  tier: { paints: 10, percent: 35 },
  ownCount: 1,
  fillerCount: 0,
  melted: [],
  bought: [{ skuId: index, name: `${index}`.padEnd(7000, 'x'), count: 1, value: 5, filler: false }],
  freed: 0,
  paid: 5,
  result: 0,
  meltBefore: 0,
  meltAfter: 0,
});

/** The synced storage refuses what goes beyond its limits, like the browser's. */
function enforceQuota() {
  const sync = fakeBrowser.storage.sync;
  const set = sync.set.bind(sync);
  return vi.spyOn(sync, 'set').mockImplementation(async (items) => {
    const after = { ...(await sync.get(null)), ...items };
    const total = Object.entries(after).reduce((sum, [key, value]) => sum + bytesOf(key, value), 0);
    if (total > SYNC_QUOTA.total) throw new Error('QUOTA_BYTES quota exceeded');
    return set(items);
  });
}

describe('writeSettingsImport', () => {
  it('writes the settings and your data', async () => {
    await fakeBrowser.storage.sync.set({
      'watchlist.old': { v: 1 },
      watchlists: { v: 1, ids: ['old'] },
    });
    const { values } = settingsImportOf(exported());
    await writeSettingsImport(values);
    expect((await loadWatchlists()).map((entry) => entry.id)).toEqual(['a', 'b']);
    const synced = await fakeBrowser.storage.sync.get(null);
    expect(synced['watchlist.old']).toBeUndefined();
    expect(synced['hangar.meltMarks']).toEqual({ 101: 1_700_000_000_000 });
    expect(synced.settings).toMatchObject({ theme: 'rsi', compactView: true });
    expect((await fakeBrowser.storage.local.get('notifications')).notifications).toHaveLength(1);
  });

  it('writes nothing that wouldn’t fit', async () => {
    await fakeBrowser.storage.sync.set({ other: 'x'.repeat(SYNC_QUOTA.total - 500) });
    const { values } = settingsImportOf(exported());
    await expect(writeSettingsImport(values)).rejects.toBeInstanceOf(ImportQuotaError);
    expect(Object.keys(await fakeBrowser.storage.sync.get(null))).toEqual(['other']);
  });

  it('makes room first: completed plans give way and stay in this browser', async () => {
    const plans = Array.from({ length: 10 }, (_, index) => completed(index));
    await fakeBrowser.storage.sync.set({
      'consultant.done': { v: 1, ids: plans.map(completedIdOf) },
      ...Object.fromEntries(
        plans.map((plan) => [`consultant.done.${completedIdOf(plan)}`, encodeCompleted(plan)]),
      ),
      other: 'x'.repeat(20_000),
    });
    const spy = enforceQuota();
    const lists = Array.from({ length: 4 }, (_, index) =>
      list(`l${index}`, { description: 'd'.repeat(7000) }),
    );
    await writeSettingsImport({ watchlists: lists, riskNoteSeen: true });
    spy.mockRestore();
    expect((await loadWatchlists()).map((entry) => entry.id)).toEqual(['l0', 'l1', 'l2', 'l3']);
    const kept = await loadCompleted();
    expect(kept.map(completedIdOf).sort()).toEqual(plans.map(completedIdOf).sort());
    const synced = await fakeBrowser.storage.sync.get(null);
    const total = Object.entries(synced).reduce(
      (sum, [key, value]) => sum + bytesOf(key, value),
      0,
    );
    expect(total).toBeLessThanOrEqual(SYNC_QUOTA.total);
    // The newest that fit are synced again.
    expect(Object.keys(synced).some((key) => key.startsWith('consultant.done.'))).toBe(true);
  });

  it('merges with what is here when confirmed, not when the file was read', async () => {
    await saveWatchlist(list('a'));
    const file = { watchlists: [list('f')], meltMarks: { 2: 200 } };
    const read = await currentValues(['watchlists', 'meltMarks']);
    // Meanwhile, another tab or device adds a watchlist and a mark.
    await saveWatchlist(list('meanwhile'));
    await fakeBrowser.storage.sync.set({ 'hangar.meltMarks': { 1: 100 } });
    const stale = valuesToWrite(file, read);
    expect((stale.watchlists as Watchlist[]).map((entry) => entry.id)).not.toContain('meanwhile');
    await writeSettingsImport(valuesToWrite(file, await currentValues(Object.keys(file) as never)));
    expect((await loadWatchlists()).map((entry) => entry.id).sort()).toEqual([
      'a',
      'f',
      'meanwhile',
    ]);
    expect((await fakeBrowser.storage.sync.get('hangar.meltMarks'))['hangar.meltMarks']).toEqual({
      1: 100,
      2: 200,
    });
  });

  it('keeps this browser’s choice of bulk melting', async () => {
    await fakeBrowser.storage.sync.set({ settings: { bulkMelting: false } });
    await writeSettingsImport({
      settings: { ...DEFAULT_SETTINGS, bulkMelting: true, bulkMeltingMax: 20 },
    });
    expect((await fakeBrowser.storage.sync.get('settings')).settings).toMatchObject({
      bulkMelting: false,
      bulkMeltingMax: 20,
    });
  });

  it('puts everything back when a write fails', async () => {
    await fakeBrowser.storage.sync.set({
      settings: { theme: 'modern' },
      watchlists: { v: 1, ids: [] },
    });
    await fakeBrowser.storage.local.set({ notifications: [{ id: 'kept', text: 'Kept', at: 1 }] });
    const before = await fakeBrowser.storage.sync.get(null);
    const { values } = settingsImportOf(exported());
    const set = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    const spy = vi
      .spyOn(fakeBrowser.storage.local, 'set')
      .mockImplementationOnce(() => Promise.reject(new Error('disk full')))
      .mockImplementation(set);
    await expect(writeSettingsImport(values)).rejects.toThrow('disk full');
    spy.mockRestore();
    expect(await fakeBrowser.storage.sync.get(null)).toEqual(before);
    expect((await fakeBrowser.storage.local.get('notifications')).notifications).toEqual([
      { id: 'kept', text: 'Kept', at: 1 },
    ]);
  });
});

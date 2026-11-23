import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { CompletedPaintPlan } from '@/store/paint-consultant/completed-plans';
import type { StoredRebuyPlan } from '@/store/paint-consultant/rebuy-plan-storage';
import type { WarbondSighting } from '@/store/warbond-history';
import { loadWatchlists } from '@/watchlists/watchlists-storage';
import type { WatchItem, Watchlist } from '@/watchlists/watchlists';
import {
  mergeMeltMarks,
  mergePaintHistory,
  mergePaintPlan,
  mergeWarbondHistory,
  mergeWatchlists,
  plansCollide,
  replaceCounts,
  valuesToWrite,
} from './merge';
import { writeSettingsImport } from './settings-import';

/* Merging your data on import (#634). */

beforeEach(() => fakeBrowser.reset());

const paint = (skuId: number, count = 1): WatchItem => ({
  kind: 'storePaint',
  skuId,
  name: `Paint ${skuId}`,
  addedAt: 1_700_000_000_000,
  count,
});
const list = (
  id: string,
  changedAt: number,
  items: WatchItem[],
  name = `List ${id}`,
): Watchlist => ({
  id,
  name,
  description: '',
  reminder: false,
  storeAlerts: false,
  items,
  createdAt: 1_700_000_000_000,
  changedAt,
});

describe('mergeWatchlists', () => {
  it('adds the lists only in the file, after the ones here', () => {
    const { value, counts } = mergeWatchlists([list('a', 1, [])], [list('b', 1, [])]);
    expect(value.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(counts).toEqual({ added: 1, changed: 0, kept: 1, leftOut: 0 });
  });

  it('keeps the newer name and the union of the items, the higher count', () => {
    const here = list('a', 2, [paint(1), paint(2, 3)], 'Old');
    const file = list('a', 5, [paint(2, 1), paint(3, 2)], 'New');
    const { value, counts } = mergeWatchlists([here], [file]);
    expect(value[0]).toMatchObject({ name: 'New', changedAt: 5 });
    expect(
      value[0]!.items.map((item) => [item.kind === 'storePaint' && item.skuId, item.count]),
    ).toEqual([
      [1, 1],
      [2, 3],
      [3, 2],
    ]);
    expect(counts).toEqual({ added: 0, changed: 1, kept: 0, leftOut: 0 });
  });

  it('keeps a list here that the file has older and with the same items', () => {
    const here = list('a', 5, [paint(1)], 'Mine');
    const { value, counts } = mergeWatchlists([here], [list('a', 2, [paint(1)], 'Theirs')]);
    expect(value).toEqual([here]);
    expect(counts.kept).toBe(1);
  });

  it('works with nothing on either side', () => {
    expect(mergeWatchlists([], []).value).toEqual([]);
    expect(mergeWatchlists([], [list('a', 1, [])]).counts.added).toBe(1);
    expect(mergeWatchlists([list('a', 1, [])], []).counts.kept).toBe(1);
  });
});

describe('mergeMeltMarks', () => {
  it('joins the marks, the earlier time', () => {
    const { value, counts } = mergeMeltMarks({ 1: 100, 2: 500 }, { 2: 300, 3: 900, 1: 200 });
    expect(value).toEqual({ 1: 100, 2: 300, 3: 900 });
    expect(counts).toEqual({ added: 1, changed: 1, kept: 1, leftOut: 0 });
  });

  it('works with nothing on either side', () => {
    expect(mergeMeltMarks({}, {}).value).toEqual({});
    expect(mergeMeltMarks({}, { 1: 1 }).counts.added).toBe(1);
  });
});

describe('mergePaintPlan', () => {
  const plan = (at: number) => ({ version: 2, at }) as unknown as StoredRebuyPlan;

  it('takes the file’s plan without one here', () => {
    expect(mergePaintPlan(null, plan(1))).toEqual({
      value: plan(1),
      counts: { added: 1, changed: 0, kept: 0, leftOut: 0 },
    });
    expect(mergePaintPlan(plan(1), null).value).toEqual(plan(1));
    expect(mergePaintPlan(null, null).value).toBeNull();
  });

  it('keeps only the one chosen when both have one', () => {
    expect(mergePaintPlan(plan(1), plan(2)).value).toEqual(plan(1));
    expect(mergePaintPlan(plan(1), plan(2), 'file')).toEqual({
      value: plan(2),
      counts: { added: 0, changed: 1, kept: 0, leftOut: 1 },
    });
    expect(plansCollide({ paintPlan: plan(1) }, { paintPlan: plan(2) })).toBe(true);
    expect(plansCollide({ paintPlan: plan(1) }, { paintPlan: plan(1) })).toBe(false);
    expect(plansCollide({ paintPlan: null }, { paintPlan: plan(1) })).toBe(false);
  });
});

describe('mergePaintHistory', () => {
  const done = (startedAt: number) =>
    ({ startedAt, completedAt: startedAt + 10, way: 'buy' }) as unknown as CompletedPaintPlan;
  const snapshot = (plans: CompletedPaintPlan[]) => ({ version: 1, plans });

  it('joins the plans by plan, newest first', () => {
    const { value, counts } = mergePaintHistory(
      snapshot([done(3), done(1)]),
      snapshot([done(2), done(1)]),
    );
    expect(value.plans.map((plan) => plan.startedAt)).toEqual([3, 2, 1]);
    expect(counts).toEqual({ added: 1, changed: 0, kept: 2, leftOut: 0 });
  });

  it('keeps no more than the number kept', () => {
    const here = snapshot(Array.from({ length: 15 }, (_, index) => done(100 + index)));
    const file = snapshot(Array.from({ length: 10 }, (_, index) => done(index)));
    const { value, counts } = mergePaintHistory(here, file);
    expect(value.plans).toHaveLength(20);
    expect(counts).toEqual({ added: 5, changed: 0, kept: 15, leftOut: 5 });
  });

  it('works with nothing on either side', () => {
    expect(mergePaintHistory(null, snapshot([])).value.plans).toEqual([]);
  });
});

describe('mergeWarbondHistory', () => {
  const seen = (skuId: number, price: number, firstSeen: number, lastSeen: number, extra = {}) =>
    ({
      shipId: 1,
      skuId,
      shipName: 'Perseus',
      price,
      msrp: 975,
      firstSeen,
      lastSeen,
      ...extra,
    }) as WarbondSighting;
  const history = (sightings: WarbondSighting[], lastReadAt = 0) => ({
    version: 1,
    lastReadAt,
    sightings,
  });
  const event = (id: string) => ({ id, name: { en: id } });

  it('joins overlapping sightings of the same offer into one', () => {
    const { value, counts } = mergeWarbondHistory(
      history([seen(1, 800, 10, 20, { events: [event('iae')] })], 20),
      history([seen(1, 800, 15, 30, { events: [event('bis')], expectedEnd: 40 })], 30),
    );
    expect(value.sightings).toEqual([
      seen(1, 800, 10, 30, { events: [event('iae'), event('bis')], expectedEnd: 40 }),
    ]);
    expect(value.lastReadAt).toBe(30);
    expect(counts).toEqual({ added: 0, changed: 1, kept: 0, leftOut: 0 });
  });

  it('adds other offers and later sightings, oldest first', () => {
    const { value, counts } = mergeWarbondHistory(
      history([seen(1, 800, 50, 60)]),
      history([seen(1, 800, 10, 20), seen(1, 750, 50, 60), seen(2, 800, 55, 58)]),
    );
    expect(value.sightings.map((s) => [s.skuId, s.price, s.firstSeen])).toEqual([
      [1, 800, 10],
      [1, 800, 50],
      [1, 750, 50],
      [2, 800, 55],
    ]);
    expect(counts).toEqual({ added: 3, changed: 0, kept: 1, leftOut: 0 });
  });

  it('works with nothing on either side', () => {
    expect(mergeWarbondHistory(null, history([])).value.sightings).toEqual([]);
  });
});

describe('valuesToWrite', () => {
  it('merges your data by default and replaces on request; the settings are replaced', () => {
    const here = { meltMarks: { 1: 100 }, settings: { theme: 'modern' } };
    const file = { meltMarks: { 2: 200 }, settings: { theme: 'rsi' } };
    expect(valuesToWrite(file, here)).toEqual({
      meltMarks: { 1: 100, 2: 200 },
      settings: { theme: 'rsi' },
    });
    expect(valuesToWrite(file, here, { meltMarks: 'replace' }).meltMarks).toEqual({ 2: 200 });
  });

  it('says what a replace does', () => {
    expect(replaceCounts(3, 2)).toEqual({ added: 2, changed: 0, kept: 0, leftOut: 3 });
  });

  it('keeps the watchlists of both browsers when written', async () => {
    const here = [list('a', 1, [paint(1)])];
    const file = [list('b', 1, [paint(2)])];
    await writeSettingsImport(valuesToWrite({ watchlists: file }, { watchlists: here }));
    expect((await loadWatchlists()).map((entry) => entry.id)).toEqual(['a', 'b']);
    await writeSettingsImport(
      valuesToWrite({ watchlists: file }, { watchlists: here }, { watchlists: 'replace' }),
    );
    expect((await loadWatchlists()).map((entry) => entry.id)).toEqual(['b']);
  });
});

import { describe, expect, it } from 'vitest';
import { bytesOf, SYNC_QUOTA } from '@/watchlists/watchlists-storage';
import { measureSynced, nearLimits, syncedIdOf } from './synced-usage';
import { LOCAL_COPY, SYNCED } from './registry';

/* The synced storage in the settings' stored data (#560). */

describe('the storages kept in the synced storage', () => {
  it('are the watchlists and the marks to melt, apart from the local copy', () => {
    expect(SYNCED.map((storage) => storage.id)).toEqual(['watchlists', 'meltMarks']);
    expect(SYNCED.every((storage) => storage.readAgain === 'never')).toBe(true);
    expect(LOCAL_COPY.some((storage) => storage.kind === 'synced')).toBe(false);
  });

  it('are told by their keys', () => {
    expect(syncedIdOf('watchlists')).toBe('watchlists');
    expect(syncedIdOf('watchlist.abc')).toBe('watchlists');
    expect(syncedIdOf('hangar.meltMarks')).toBe('meltMarks');
    expect(syncedIdOf('settings')).toBeUndefined();
  });
});

describe('measureSynced', () => {
  const stored = {
    settings: { theme: 'modern' },
    watchlists: { v: 1, ids: ['a', 'b'] },
    'watchlist.a': { v: 1, n: 'IAE' },
    'watchlist.b': { v: 1, n: 'Melt later' },
    'hangar.meltMarks': { 1: 100, 2: 200, 3: 300 },
  };

  it('counts the lists and marks, their sizes and everything stored', () => {
    const usage = measureSynced(stored);
    expect(usage.rows.watchlists.entries).toBe(2);
    expect(usage.rows.meltMarks.entries).toBe(3);
    expect(usage.rows.meltMarks.bytes).toBe(
      bytesOf('hangar.meltMarks', stored['hangar.meltMarks']),
    );
    expect(usage.keys).toBe(5);
    expect(usage.bytes).toBe(
      Object.entries(stored).reduce((sum, [key, value]) => sum + bytesOf(key, value), 0),
    );
  });

  it('is empty without anything stored', () => {
    const usage = measureSynced({});
    expect(usage.rows.watchlists).toEqual({ entries: 0, bytes: 0, largestKey: 0 });
    expect(nearLimits(usage)).toEqual({ total: false, keys: false, perKey: [] });
  });
});

describe('nearLimits', () => {
  it('warns near the whole quota, the number of keys and the size of a key', () => {
    const usage = measureSynced({ 'hangar.meltMarks': { 1: 'x'.repeat(7000) } });
    expect(nearLimits(usage).perKey).toEqual(['meltMarks']);
    expect(nearLimits({ ...usage, bytes: SYNC_QUOTA.total * 0.9 }).total).toBe(true);
    expect(nearLimits({ ...usage, keys: SYNC_QUOTA.maxItems * 0.9 }).keys).toBe(true);
    expect(nearLimits({ ...usage, bytes: SYNC_QUOTA.total * 0.5 }).total).toBe(false);
  });
});

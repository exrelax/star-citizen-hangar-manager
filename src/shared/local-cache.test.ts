import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { buybackMeta, buybackSnapshot } from '@/buyback/buyback-storage';
import { hangarMeta, hangarSnapshot } from '@/hangar/hangar-storage';
import { settingsItem } from '@/settings/settings';
import { LOCAL_COPY } from '@/storage/registry';
import { clearLocalCache, clearStorage } from './local-cache';

beforeEach(async () => {
  fakeBrowser.reset();
  await hangarSnapshot.setValue({ pledges: [] } as never);
  await hangarMeta.setValue({ syncedAt: 1, updatedAt: 1, checkedAt: 1, lastOutcome: null });
  await buybackSnapshot.setValue({ pledges: [] } as never);
  await buybackMeta.setValue({ syncedAt: 1, updatedAt: 1, checkedAt: 1, lastOutcome: null });
  await settingsItem.setValue({ theme: 'rsi' });
});

describe('clearStorage', () => {
  it('deletes one storage with its metadata and leaves the others', async () => {
    await clearStorage(LOCAL_COPY.find((storage) => storage.id === 'buyback')!);
    expect(await buybackSnapshot.getValue()).toBeNull();
    expect((await buybackMeta.getValue()).checkedAt).toBe(0);
    expect(await hangarSnapshot.getValue()).not.toBeNull();
    expect((await hangarMeta.getValue()).checkedAt).toBe(1);
  });
});

describe('clearLocalCache', () => {
  it('deletes every storage of the local copy, but not the settings', async () => {
    await clearLocalCache();
    expect(await hangarSnapshot.getValue()).toBeNull();
    expect(await buybackSnapshot.getValue()).toBeNull();
    expect(await settingsItem.getValue()).toEqual({ theme: 'rsi' });
  });
});

describe('LOCAL_COPY', () => {
  it('knows for each storage how to count it and when it is read again', () => {
    for (const storage of LOCAL_COPY) {
      expect(storage.count, storage.id).toBeTypeOf('function');
      expect(storage.readAgain, storage.id).toBeDefined();
    }
  });
});

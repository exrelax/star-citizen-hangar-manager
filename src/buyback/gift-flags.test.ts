import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { hangarSnapshot } from '@/hangar/hangar-storage';
import { HANGAR_SNAPSHOT_VERSION, type HangarSnapshot, type Pledge } from '@/hangar/pledge';
import { giftFlagsItem, leftGiftFlags, watchGiftFlags } from './gift-flags';

const pledge = (id: number, isGiftable: boolean, extra: Partial<Pledge> = {}) =>
  ({ id, isGiftable, ...extra }) as Pledge;

const hangar = (pledges: Pledge[], version = HANGAR_SNAPSHOT_VERSION) =>
  ({ version, syncedAt: '2026-11-10T00:00:00Z', pledges }) as HangarSnapshot;

describe('leftGiftFlags', () => {
  it('keeps the flags of the pledges that left the hangar', () => {
    const before = hangar([
      pledge(1, true),
      pledge(2, false),
      pledge(3, true, { protectedGames: ['SC'] }),
      pledge(4, true),
    ]);
    expect(leftGiftFlags(before, hangar([pledge(4, true)]))).toEqual({
      1: true,
      2: false,
      3: false,
    });
  });

  it('tells nothing without both snapshots of the current version', () => {
    expect(leftGiftFlags(null, hangar([]))).toEqual({});
    expect(leftGiftFlags(hangar([pledge(1, true)]), hangar([], -1))).toEqual({});
  });
});

describe('watchGiftFlags', () => {
  beforeEach(() => fakeBrowser.reset());

  it('adds the flags of pledges leaving the stored hangar', async () => {
    await giftFlagsItem.setValue({ 9: true });
    await hangarSnapshot.setValue(hangar([pledge(1, true), pledge(2, false)]));
    watchGiftFlags();
    await hangarSnapshot.setValue(hangar([pledge(2, false)]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await giftFlagsItem.getValue()).toEqual({ 9: true, 1: true });
  });
});

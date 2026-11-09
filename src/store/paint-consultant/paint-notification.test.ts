import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  demoDismissedPaintsItem,
  dismissedOf,
  dismissedPaintsItem,
  isPaintNotificationShown,
} from './paint-notification';

beforeEach(() => fakeBrowser.reset());

describe('isPaintNotificationShown', () => {
  it('shows without paints dismissed, and never without paints', () => {
    expect(isPaintNotificationShown([1, 2], [])).toBe(true);
    expect(isPaintNotificationShown([], [])).toBe(false);
  });

  it('stays dismissed for exactly the dismissed paints', () => {
    expect(isPaintNotificationShown([1, 2], [1, 2])).toBe(false);
    // Paints that can't be bought again any more don't bring it back.
    expect(isPaintNotificationShown([2], [1, 2])).toBe(false);
  });

  it('comes back once another paint can be bought again', () => {
    expect(isPaintNotificationShown([1, 2, 3], [1, 2])).toBe(true);
  });
});

describe('dismissedOf', () => {
  it('keeps each paint of now once, sorted', () => {
    expect(dismissedOf([3, 1, 3, 2])).toEqual([1, 2, 3]);
  });
});

describe('storage', () => {
  it('keeps the dismissed paints in the sync storage, the demo ones apart', async () => {
    await dismissedPaintsItem.setValue([1, 2]);
    expect(await fakeBrowser.storage.sync.get('consultant.dismissedPaints')).toEqual({
      'consultant.dismissedPaints': [1, 2],
    });
    expect(await demoDismissedPaintsItem.getValue()).toEqual([]);
  });
});

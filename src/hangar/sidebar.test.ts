import { describe, expect, it } from 'vitest';
import { moveBox, normalizeSidebarOrder, placeBox, SIDEBAR_BOXES, sidebarBoxesOf } from './sidebar';

describe('sidebarBoxesOf', () => {
  it('keeps known boxes once', () => {
    expect(sidebarBoxesOf(['summary', 'events', 'summary', 'selection'])).toEqual([
      'summary',
      'selection',
    ]);
  });

  it('gives no boxes without a list', () => {
    expect(sidebarBoxesOf(undefined)).toEqual([]);
    expect(sidebarBoxesOf('summary')).toEqual([]);
  });
});

describe('normalizeSidebarOrder', () => {
  it('keeps a complete stored order', () => {
    expect(normalizeSidebarOrder(['selection', 'storeCredit', 'summary'])).toEqual([
      'selection',
      'storeCredit',
      'summary',
    ]);
  });

  it('falls back to the default order without a valid one', () => {
    expect(normalizeSidebarOrder(undefined)).toEqual([...SIDEBAR_BOXES]);
    expect(normalizeSidebarOrder('summary')).toEqual([...SIDEBAR_BOXES]);
  });

  it('drops unknown and repeated boxes', () => {
    expect(
      normalizeSidebarOrder(['summary', 'events', 'summary', 'storeCredit', 'selection']),
    ).toEqual(['summary', 'storeCredit', 'selection']);
  });

  it('adds missing boxes after the box before them in the default order', () => {
    expect(normalizeSidebarOrder(['selection', 'storeCredit'])).toEqual([
      'selection',
      'storeCredit',
      'summary',
    ]);
    expect(normalizeSidebarOrder(['summary', 'selection'])).toEqual([
      'storeCredit',
      'summary',
      'selection',
    ]);
  });
});

describe('placeBox', () => {
  const order = ['storeCredit', 'summary', 'selection'] as const;

  it('places a box before or after another', () => {
    expect(placeBox(order, 'selection', 'storeCredit', false)).toEqual([
      'selection',
      'storeCredit',
      'summary',
    ]);
    expect(placeBox(order, 'storeCredit', 'selection', true)).toEqual([
      'summary',
      'selection',
      'storeCredit',
    ]);
  });

  it('keeps the order for the box itself', () => {
    expect(placeBox(order, 'summary', 'summary', true)).toEqual([...order]);
  });
});

describe('moveBox', () => {
  const order = ['storeCredit', 'summary', 'selection'] as const;

  it('moves a box one place up or down', () => {
    expect(moveBox(order, 'summary', -1, order)).toEqual(['summary', 'storeCredit', 'selection']);
    expect(moveBox(order, 'summary', 1, order)).toEqual(['storeCredit', 'selection', 'summary']);
  });

  it('keeps the order at the top and the bottom', () => {
    expect(moveBox(order, 'storeCredit', -1, order)).toEqual([...order]);
    expect(moveBox(order, 'selection', 1, order)).toEqual([...order]);
  });

  it('skips hidden boxes, which keep their place', () => {
    // Without a selection, the summary moves past the hidden selection box to the bottom.
    expect(moveBox(order, 'storeCredit', 1, ['storeCredit', 'summary'])).toEqual([
      'summary',
      'storeCredit',
      'selection',
    ]);
    expect(moveBox(order, 'summary', 1, ['storeCredit', 'summary'])).toEqual([...order]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  canSelectPledges,
  moveBox,
  normalizeSidebarOrder,
  placeAt,
  placeBox,
  SIDEBAR_BOXES,
  sidebarBoxesOf,
} from './sidebar';

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

describe('placeAt', () => {
  // Store credit (60 px) at 0, the dragged summary (100 px) below it, selection below that.
  const order = ['storeCredit', 'summary', 'selection'] as const;
  const others = [
    { box: 'storeCredit', middle: 30 },
    { box: 'selection', middle: 110 },
  ] as const;

  it('moves a box above the one whose middle the pointer passes', () => {
    // A box higher than the one above can't get its middle past that one's: the pointer can.
    expect(placeAt(order, 'summary', others, 20)).toEqual(['summary', 'storeCredit', 'selection']);
  });

  it('keeps the place between the middles', () => {
    expect(placeAt(order, 'summary', others, 70)).toEqual([...order]);
  });

  it('moves a box below the last one once the pointer passes its middle', () => {
    expect(placeAt(order, 'summary', others, 140)).toEqual(['storeCredit', 'selection', 'summary']);
  });

  it('keeps the order without other boxes', () => {
    expect(placeAt(order, 'summary', [], 0)).toEqual([...order]);
  });
});

describe('canSelectPledges', () => {
  it('needs the sidebar and its "Selected" box', () => {
    expect(canSelectPledges({ sidebar: true, sidebarHidden: [] })).toBe(true);
    expect(canSelectPledges({ sidebar: true, sidebarHidden: ['storeCredit'] })).toBe(true);
    expect(canSelectPledges({ sidebar: false, sidebarHidden: [] })).toBe(false);
    expect(canSelectPledges({ sidebar: true, sidebarHidden: ['selection'] })).toBe(false);
  });
});

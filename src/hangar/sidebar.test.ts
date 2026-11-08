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
    const order = ['paintConsultant', 'selection', 'notifications', 'summary'];
    expect(normalizeSidebarOrder(order)).toEqual(order);
  });

  it('falls back to the default order without a valid one', () => {
    expect(normalizeSidebarOrder(undefined)).toEqual([...SIDEBAR_BOXES]);
    expect(normalizeSidebarOrder('summary')).toEqual([...SIDEBAR_BOXES]);
  });

  it('drops unknown and repeated boxes', () => {
    expect(normalizeSidebarOrder(['summary', 'events', 'summary', 'selection'])).toEqual([
      'notifications',
      'summary',
      'selection',
      'paintConsultant',
    ]);
  });

  it('drops the store credit box of older versions (#156)', () => {
    expect(
      normalizeSidebarOrder([
        'notifications',
        'storeCredit',
        'summary',
        'selection',
        'paintConsultant',
      ]),
    ).toEqual(['notifications', 'summary', 'selection', 'paintConsultant']);
    expect(sidebarBoxesOf(['storeCredit', 'selection'])).toEqual(['selection']);
  });

  it('adds missing boxes after the box before them in the default order', () => {
    expect(normalizeSidebarOrder(['selection', 'notifications'])).toEqual([
      'selection',
      'paintConsultant',
      'notifications',
      'summary',
    ]);
    expect(normalizeSidebarOrder(['summary', 'selection'])).toEqual([
      'notifications',
      'summary',
      'selection',
      'paintConsultant',
    ]);
  });

  it('adds a box new in an update after the box before it', () => {
    // An order stored before the Paint Discount Consultant's box: it follows "Selected".
    expect(normalizeSidebarOrder(['notifications', 'selection', 'summary'])).toEqual([
      'notifications',
      'selection',
      'paintConsultant',
      'summary',
    ]);
  });

  it('puts the notifications on top of an order stored before them', () => {
    const before = ['paintConsultant', 'summary', 'selection'];
    expect(normalizeSidebarOrder(before)).toEqual(['notifications', ...before]);
  });
});

describe('placeBox', () => {
  const order = ['notifications', 'summary', 'selection'] as const;

  it('places a box before or after another', () => {
    expect(placeBox(order, 'selection', 'notifications', false)).toEqual([
      'selection',
      'notifications',
      'summary',
    ]);
    expect(placeBox(order, 'notifications', 'selection', true)).toEqual([
      'summary',
      'selection',
      'notifications',
    ]);
  });

  it('keeps the order for the box itself', () => {
    expect(placeBox(order, 'summary', 'summary', true)).toEqual([...order]);
  });
});

describe('moveBox', () => {
  const order = ['notifications', 'summary', 'selection'] as const;

  it('moves a box one place up or down', () => {
    expect(moveBox(order, 'summary', -1, order)).toEqual(['summary', 'notifications', 'selection']);
    expect(moveBox(order, 'summary', 1, order)).toEqual(['notifications', 'selection', 'summary']);
  });

  it('keeps the order at the top and the bottom', () => {
    expect(moveBox(order, 'notifications', -1, order)).toEqual([...order]);
    expect(moveBox(order, 'selection', 1, order)).toEqual([...order]);
  });

  it('skips hidden boxes, which keep their place', () => {
    // Without a selection, the summary moves past the hidden selection box to the bottom.
    expect(moveBox(order, 'notifications', 1, ['notifications', 'summary'])).toEqual([
      'summary',
      'notifications',
      'selection',
    ]);
    expect(moveBox(order, 'summary', 1, ['notifications', 'summary'])).toEqual([...order]);
  });
});

describe('placeAt', () => {
  // Notifications (60 px) at 0, the dragged summary (100 px) below it, selection below that.
  const order = ['notifications', 'summary', 'selection'] as const;
  const others = [
    { box: 'notifications', middle: 30 },
    { box: 'selection', middle: 110 },
  ] as const;

  it('moves a box above the one whose middle the pointer passes', () => {
    // A box higher than the one above can't get its middle past that one's: the pointer can.
    expect(placeAt(order, 'summary', others, 20)).toEqual([
      'summary',
      'notifications',
      'selection',
    ]);
  });

  it('keeps the place between the middles', () => {
    expect(placeAt(order, 'summary', others, 70)).toEqual([...order]);
  });

  it('moves a box below the last one once the pointer passes its middle', () => {
    expect(placeAt(order, 'summary', others, 140)).toEqual([
      'notifications',
      'selection',
      'summary',
    ]);
  });

  it('keeps the order without other boxes', () => {
    expect(placeAt(order, 'summary', [], 0)).toEqual([...order]);
  });
});

describe('canSelectPledges', () => {
  it('needs the sidebar and its "Selected" box', () => {
    expect(canSelectPledges({ sidebar: true, sidebarHidden: [] })).toBe(true);
    expect(canSelectPledges({ sidebar: true, sidebarHidden: ['summary'] })).toBe(true);
    expect(canSelectPledges({ sidebar: false, sidebarHidden: [] })).toBe(false);
    expect(canSelectPledges({ sidebar: true, sidebarHidden: ['selection'] })).toBe(false);
  });
});

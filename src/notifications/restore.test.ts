import { describe, expect, it } from 'vitest';
import type { StarCitizenEvent } from '@/events/events';
import type { StoreItem } from '@/store/items/store-items';
import type { AppNotification } from './notifications';
import { restorable, stillMatters, withRestored, type RestoreContext } from './restore';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const DONE = NOW - 1000;

const iae: StarCitizenEvent = {
  id: 'iae-2956',
  name: { en: 'IAE 2956' },
  eventStart: Date.parse('2026-11-13T16:00:00Z'),
  eventEnd: Date.parse('2026-11-27T20:00:00Z'),
  displayStart: Date.parse('2026-11-06T00:00:00Z'),
  displayEnd: Date.parse('2026-11-27T20:00:00Z'),
};

const item = (id: number, price: number, extra: Partial<StoreItem> = {}): StoreItem => ({
  id,
  name: `Item ${id}`,
  category: 'Paints',
  price,
  isWarbond: false,
  available: true,
  ...extra,
});

const context: RestoreContext = {
  events: [iae],
  warbonds: [{ shipId: 1, skuId: 100, price: 275 }],
  items: [item(1, 9), item(2, 20, { discountedPrice: 15 }), item(3, 5, { available: false })],
  notificationsOff: [],
  now: NOW,
};

const note = (overrides: Partial<AppNotification>): AppNotification => ({
  id: 'x',
  text: 'Text',
  at: NOW - 60_000,
  doneAt: DONE,
  ...overrides,
});

describe('stillMatters', () => {
  it('brings an event back while it is shown', () => {
    expect(stillMatters(note({ id: 'events:iae-2956', kind: 'events' }), context)).toBe(true);
    const over = { ...context, now: Date.parse('2026-11-28T00:00:00Z') };
    expect(stillMatters(note({ id: 'events:iae-2956', kind: 'events' }), over)).toBe(false);
    expect(stillMatters(note({ id: 'events:gone', kind: 'events' }), context)).toBe(false);
  });

  it('brings new warbond CCUs back while one is still offered', () => {
    const offered = note({ kind: 'warbonds', subject: { warbonds: [99, 100] } });
    expect(stillMatters(offered, context)).toBe(true);
    expect(stillMatters({ ...offered, subject: { warbonds: [99] } }, context)).toBe(false);
  });

  it('brings changed items back while one still has that price', () => {
    const changed = (items: { id: number; price: number }[]) =>
      note({ kind: 'storeItems', subject: { items } });
    expect(stillMatters(changed([{ id: 1, price: 9 }]), context)).toBe(true);
    expect(stillMatters(changed([{ id: 2, price: 15 }]), context)).toBe(true);
    expect(stillMatters(changed([{ id: 1, price: 12 }]), context)).toBe(false);
    expect(stillMatters(changed([{ id: 3, price: 5 }]), context)).toBe(false);
  });

  it('leaves out notifications without data, and kinds turned off', () => {
    expect(stillMatters(note({ kind: 'warbonds' }), context)).toBe(false);
    expect(stillMatters(note({}), context)).toBe(false);
    const off = { ...context, notificationsOff: ['events' as const] };
    expect(stillMatters(note({ id: 'events:iae-2956', kind: 'events' }), off)).toBe(false);
  });
});

describe('restorable and withRestored', () => {
  const list = [
    note({ id: 'events:iae-2956', kind: 'events' }),
    note({ id: 'warbonds:1', kind: 'warbonds', subject: { warbonds: [99] } }),
    note({ id: 'events:open', kind: 'events', doneAt: undefined }),
  ];

  it('opens the checked-off ones that still matter', () => {
    const ids = new Set(restorable(list, context).map((n) => n.id));
    expect([...ids]).toEqual(['events:iae-2956']);
    const restored = withRestored(list, ids);
    expect(restored[0]?.doneAt).toBeUndefined();
    expect(restored[1]?.doneAt).toBe(DONE);
    expect(withRestored(list, new Set())).toBe(list);
  });
});

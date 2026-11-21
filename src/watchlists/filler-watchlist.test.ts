import { describe, expect, it } from 'vitest';
import { fillerWatchlist, fillerWatchlistId } from './filler-watchlist';

const NOW = Date.parse('2026-11-22T12:00:00Z');

describe('the filler paints’ watchlist (#473)', () => {
  it('is made from the order with the fillers and a reminder 24 hours after it', () => {
    const list = fillerWatchlist({
      orderId: '4OLB2S5WUG6PX',
      boughtAt: '2026-11-22T10:30',
      fillers: [
        { id: 11, title: 'Paints - Aurora - Dusk' },
        { id: 12, title: 'Paints - Aurora - Dusk' },
      ],
      planAt: NOW,
      now: NOW,
      locale: 'en',
    });
    expect(list).toMatchObject({
      id: '4olb2s5wug6px'.replace(/^/, 'fill'),
      name: 'Filler paints of the plan of Nov 22, 2026',
      reminder: true,
      storeAlerts: false,
      items: [
        { kind: 'hangar', pledgeId: 11, name: 'Paints - Aurora - Dusk' },
        { kind: 'hangar', pledgeId: 12, name: 'Paints - Aurora - Dusk' },
      ],
    });
    expect(list!.dueAt! - new Date(2026, 10, 22, 10, 30).getTime()).toBeGreaterThanOrEqual(
      24 * 60 * 60 * 1000,
    );
  });

  it('isn’t made without filler paints', () => {
    expect(
      fillerWatchlist({ orderId: 'X', fillers: [], planAt: NOW, now: NOW, locale: 'en' }),
    ).toBeUndefined();
  });

  it('has an id an action can carry', () => {
    expect(fillerWatchlistId('AB-12_cd')).toBe('fillab12cd');
  });
});

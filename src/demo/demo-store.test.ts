import { offerHistory } from '@/store/warbond-history';
import type { WarbondTarget } from '@/store/warbond';
import { warbondEndLabel } from '@/store/warbond-end';
import { describe, expect, it } from 'vitest';
import { DEMO_EXPECTED_ENDS, demoWarbondHistory } from './demo-store';

const NOW = Date.parse('2026-11-22T12:00:00Z');
const target = (id: number): WarbondTarget => ({
  ship: { id, name: `Ship ${id}`, msrp: 300 },
  skuId: id,
  price: 270,
});

describe('the demo warbond offers’ expected ends (#571)', () => {
  const warbonds = [1, 2, 3, 4].map(target);
  const history = demoWarbondHistory(warbonds, [5, 6].map(target), NOW, []);
  const endOf = (offer: WarbondTarget) =>
    offerHistory(history, { shipId: offer.ship.id, skuId: offer.skuId, price: offer.price })
      .expectedEnd;

  it('ends weeks ahead, on its last day, in its last hour, and not at all', () => {
    expect(warbonds.map(endOf)).toEqual([
      NOW + DEMO_EXPECTED_ENDS[0],
      NOW + DEMO_EXPECTED_ENDS[1],
      NOW + DEMO_EXPECTED_ENDS[2],
      undefined,
    ]);
    const labels = warbonds.map((offer) => warbondEndLabel(endOf(offer), 'Ship', NOW, 'en'));
    expect(labels.map((label) => label?.text)).toEqual([
      'Expected gone in 21 days',
      'Expected gone in 5 h 12 min',
      'Expected gone in 46:12',
      undefined,
    ]);
    expect(labels.map((label) => label?.soon)).toEqual([false, true, true, undefined]);
  });

  it('gives no expired offer an expected end', () => {
    const ended = history.sightings.filter((sighting) => sighting.expectedEnd !== undefined);
    expect(ended.map((sighting) => sighting.lastSeen)).toEqual([NOW, NOW, NOW]);
  });
});

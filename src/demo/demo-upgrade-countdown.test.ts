import { createTargetEnd } from '@/ships/upgrade-dialog-countdown';
import { describe, expect, it } from 'vitest';
import { demoCountdownSources } from './demo-upgrade-countdown';

/* The demo cases of the countdown in RSI's ship upgrade dialog (#572). */

const NOW = Date.parse('2026-11-22T12:30:00Z');
const DAY = 24 * 60 * 60 * 1000;
// 10 is always available, 20 and 30 aren't, 40 is unknown.
const availability = ({ id }: { id?: number }) =>
  id === 10 ? true : id === 20 || id === 30 ? false : undefined;

describe('demoCountdownSources', () => {
  it("counts down to the demo event's end, and one ship to a later warbond end", () => {
    const sources = demoCountdownSources(NOW, true, [30, 10, 20, 40], availability);
    const endOf = createTargetEnd({ ...sources, availability });
    // 20 is the first of the ships that aren't always available: every tenth gets a warbond end.
    const event = endOf({ id: 30 }, NOW)!;
    const warbond = endOf({ id: 20 }, NOW)!;
    expect(event.source).toBe('event');
    expect(event.event.id).toBe('demo-expo');
    expect(warbond.source).toBe('warbond');
    expect(warbond.at).toBe(event.at + 14 * DAY);
    // Always available or unknown: none.
    expect(endOf({ id: 10 }, NOW)).toBeUndefined();
    expect(endOf({ id: 40 }, NOW)).toBeUndefined();
  });

  it('shows no countdown without a running event', () => {
    const sources = demoCountdownSources(NOW, false, [20, 30], availability);
    expect(sources.offers).toEqual([]);
    const endOf = createTargetEnd({ ...sources, availability });
    expect(endOf({ id: 20 }, NOW)).toBeUndefined();
    expect(endOf({ id: 30 }, NOW)).toBeUndefined();
  });
});

describe('the made-up warbond ends', () => {
  it('go to every tenth ship that is not always available, so every price range has some', () => {
    const ids = Array.from({ length: 25 }, (_, index) => 100 + index);
    const limited = () => false;
    const { offers } = demoCountdownSources(NOW, true, ids, limited);
    expect(offers.map((offer) => offer.shipId)).toEqual([100, 105, 110, 115, 120]);
  });

  it('end before the event on every tenth from the sixth on (#632)', () => {
    const ids = Array.from({ length: 6 }, (_, index) => 100 + index);
    const limited = () => false;
    const sources = demoCountdownSources(NOW, true, ids, limited);
    const endOf = createTargetEnd({ ...sources, availability: limited });
    const event = endOf({ id: 101 }, NOW)!;
    const earlier = endOf({ id: 105 }, NOW)!;
    expect(earlier.source).toBe('warbond');
    expect(earlier.at).toBe(event.at - DAY);
  });
});

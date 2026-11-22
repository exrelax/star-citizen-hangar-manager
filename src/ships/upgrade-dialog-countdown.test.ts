import type { StarCitizenEvent } from '@/events/events';
import type { WarbondSighting } from '@/store/warbond-history';
import { describe, expect, it } from 'vitest';
import { createTargetEnd, targetEndText } from './upgrade-dialog-countdown';

/* The countdown of target ships in RSI's ship upgrade dialog (#570): which end counts. */

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-11-13T16:00:00Z');
const END = Date.parse('2026-11-27T20:00:00Z');
const iae = {
  id: 'iae-2956',
  name: { en: 'IAE 2956' },
  eventStart: START,
  eventEnd: END,
  displayStart: START,
  displayEnd: END,
} as StarCitizenEvent;
const offer = (shipId: number, expectedEnd?: number) =>
  ({
    shipId,
    skuId: shipId,
    shipName: `Ship ${shipId}`,
    price: 90,
    msrp: 100,
    firstSeen: START,
    lastSeen: START + DAY,
    ...(expectedEnd !== undefined && { expectedEnd }),
  }) as WarbondSighting;
// 1 always available, 2 and 3 not, 4 unknown to the facts.
const availability = ({ id }: { id?: number }) =>
  id === 1 ? true : id === 2 || id === 3 ? false : undefined;
const endOf = createTargetEnd({
  events: [iae],
  offers: [offer(2, END + 20 * DAY), offer(3, END - DAY)],
  availability,
});
const NOW = START + 4 * DAY;

describe('createTargetEnd', () => {
  it("counts down to the event's end, or to a later expected end of the warbond offer", () => {
    expect(endOf({ id: 3 }, NOW)).toEqual({ at: END, source: 'event', event: iae });
    expect(endOf({ id: 2 }, NOW)).toEqual({ at: END + 20 * DAY, source: 'warbond', event: iae });
  });

  it('has none on always available or unknown ships, nor without a running event', () => {
    expect(endOf({ id: 1 }, NOW)).toBeUndefined();
    expect(endOf({ id: 4 }, NOW)).toBeUndefined();
    expect(endOf({ name: 'Unknown' }, NOW)).toBeUndefined();
    expect(endOf({ id: 3 }, START - DAY)).toBeUndefined();
    expect(endOf({ id: 3 }, END)).toBeUndefined();
  });
});

describe('targetEndText', () => {
  it('counts down and names its source, saying it is expected', () => {
    const event = targetEndText(endOf({ id: 3 }, NOW)!, END - 5 * DAY - 1000, 'en');
    expect(event.text).toBe('Expected gone in 5 days');
    expect(event.hint).toMatch(/when IAE 2956 ends: it isn't always available\.\nAn expectation/);
    const warbond = targetEndText(endOf({ id: 2 }, NOW)!, NOW, 'en');
    expect(warbond.hint).toMatch(/when its warbond offer is expected to end\.\nAn expectation/);
    expect(targetEndText(endOf({ id: 3 }, NOW)!, END - 46 * 60_000 - 12_000, 'en').text).toBe(
      'Expected gone in 46:12',
    );
  });
});

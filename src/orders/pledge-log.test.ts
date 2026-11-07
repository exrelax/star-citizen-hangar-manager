import { describe, expect, it } from 'vitest';
import { pledgeIdsOfLogEntries, pledgeIdsOfLogEntry } from './pledge-log';

describe('pledgeIdsOfLogEntry', () => {
  it('reads the pledge ids of every kind of entry, without order numbers', () => {
    expect(
      pledgeIdsOfLogEntry(
        'Oct 30 2026, 7:55 pm - Paints - Paladin - Shadowfall Paint #80478064 - Buy-back by x - order #4OLB2S5WUG6PX',
      ),
    ).toEqual([80478064]);
    expect(
      pledgeIdsOfLogEntry(
        'Oct 30 2026, 4:18 pm - Upgrade - Guardian QI to Constellation Mk V #114810540 - Created by x - order #12345678, value: $15.00 USD',
      ),
    ).toEqual([114810540]);
    expect(
      pledgeIdsOfLogEntry(
        'Sep 30 2026, 6:20 pm - Standalone Ship - HoverQuad #38580456 - Upgrade applied: #107978978 Upgrade - Hull A to Nova Warbond Edition, new value: $90.00 USD',
      ),
    ).toEqual([38580456, 107978978]);
    expect(
      pledgeIdsOfLogEntry(
        'Sep 30 2026, 10:56 pm - Upgrade - Starfarer Gemini to Glaive #112668851 - Consumed by x on pledge #68746466, value: $10.00 USD',
      ),
    ).toEqual([112668851, 68746466]);
  });

  it('names every pledge once', () => {
    expect(
      pledgeIdsOfLogEntries([
        'Paint #1 - Reclaimed by x for $5.00 USD',
        'Ship #2 - Upgrade applied: #3 Upgrade - A to B, new value: $90.00 USD',
        'Upgrade - A to B #3 - Consumed by x on pledge #2, value: $10.00 USD',
      ]),
    ).toEqual([1, 2, 3]);
  });
});

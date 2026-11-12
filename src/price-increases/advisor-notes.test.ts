import { describe, expect, it } from 'vitest';
import {
  advisorNoteKey,
  advisorNotes,
  hasDismissedAhead,
  withDismissed,
  type AdvisorCcu,
  type AdvisorNoteInput,
} from './advisor-notes';
import type { CcuPriceChange } from './ccu-price-change';
import type { SecureOffer } from './ccus-to-secure';
import type { ExpectedPriceIncrease } from './price-increases';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-12T12:00:00Z');

const increase = (id: number, name: string, inDays: number): ExpectedPriceIncrease => ({
  ship: { id, name },
  priceIncreaseAt: { at: NOW + inDays * DAY },
});
const prospector = increase(109, 'Prospector', 7);
const vulture = increase(165, 'Vulture', 3);
const galaxy = increase(244, 'Galaxy', 30);

const losing = (id: number, base: ExpectedPriceIncrease, change?: number): AdvisorCcu => ({
  id,
  ccuPriceChange: {
    base,
    direction: 'loses',
    ...(change !== undefined && { amounts: { before: 20, after: 20 + change, change } }),
  },
});
const gaining = (id: number, target: ExpectedPriceIncrease): AdvisorCcu => ({
  id,
  ccuPriceChange: { target, direction: 'gains' } satisfies CcuPriceChange,
});
const offer = (rising: ExpectedPriceIncrease) => ({ increase: rising }) as SecureOffer;

const notes = (extra: Partial<AdvisorNoteInput> = {}) =>
  advisorNotes({
    ccus: [],
    secure: [],
    now: NOW,
    days: 14,
    secureHint: true,
    dismissed: [],
    ...extra,
  });

describe('advisorNotes (#254)', () => {
  it('tells per price increase the CCUs losing value and their loss, the next first', () => {
    const result = notes({
      ccus: [losing(1, prospector, -20), losing(2, vulture, -5), losing(3, prospector, -12.5)],
    });
    expect(result).toEqual([
      { kind: 'losing', key: advisorNoteKey(vulture), increase: vulture, ccuIds: [2], loss: 5 },
      {
        kind: 'losing',
        key: advisorNoteKey(prospector),
        increase: prospector,
        ccuIds: [1, 3],
        loss: 32.5,
      },
    ]);
  });

  it('leaves out the loss unless it is known for each CCU', () => {
    const [note] = notes({ ccus: [losing(1, prospector, -20), losing(2, prospector)] });
    expect(note).toMatchObject({ kind: 'losing', ccuIds: [1, 2] });
    expect(note).not.toHaveProperty('loss');
  });

  it('counts neither CCUs gaining value nor price increases outside the period', () => {
    expect(notes({ ccus: [gaining(1, prospector), losing(2, galaxy, -10)] })).toEqual([]);
    expect(notes({ ccus: [losing(2, galaxy, -10)], days: 30 })).toHaveLength(1);
  });

  it('hints to secure a CCU to a rising ship without affected CCUs, if turned on', () => {
    const secure = [offer(prospector), offer(vulture), offer(galaxy)];
    const result = notes({ ccus: [losing(1, prospector, -20)], secure });
    expect(result.map((note) => [note.kind, note.increase.ship.name])).toEqual([
      ['secure', 'Vulture'],
      ['losing', 'Prospector'],
    ]);
    expect(notes({ secure, secureHint: false })).toEqual([]);
  });

  it('stays dismissed for its price increase, and shows again once it moved', () => {
    const ccus = [losing(1, prospector, -20)];
    expect(notes({ ccus, dismissed: [advisorNoteKey(prospector)] })).toEqual([]);
    const moved = { ...prospector, priceIncreaseAt: { at: prospector.priceIncreaseAt.at + DAY } };
    expect(
      notes({ ccus: [losing(1, moved, -20)], dismissed: [advisorNoteKey(prospector)] }),
    ).toHaveLength(1);
  });

  it('no longer shows once the price increase is past', () => {
    const past = increase(109, 'Prospector', -1);
    expect(notes({ ccus: [losing(1, past, -20)], secure: [offer(past)] })).toEqual([]);
  });
});

describe('withDismissed', () => {
  it('adds the key and drops those no longer ahead', () => {
    const ahead = new Set(['109@1', '165@2']);
    expect(withDismissed(['165@2', '1@0'], '109@1', ahead)).toEqual(['165@2', '109@1']);
    expect(hasDismissedAhead(['1@0'], ahead)).toBe(false);
    expect(hasDismissedAhead(['1@0', '165@2'], ahead)).toBe(true);
  });
});

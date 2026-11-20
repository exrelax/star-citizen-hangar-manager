import { describe, expect, it } from 'vitest';
import file from '../../site/public/data/buyback-tokens.json';
import { nextTokenRenewal, parseTokenRenewals } from './token-renewals';

const DAY = 24 * 60 * 60 * 1000;
const at = (value: string) => Date.parse(value);

describe('the buy back token renewals (#434)', () => {
  it('reads the website’s file', () => {
    const renewals = parseTokenRenewals(file)!;
    expect(renewals).toHaveLength(5);
    expect(renewals[0]).toEqual({
      at: { at: at('2026-01-05T00:00:00Z'), dayOnly: true },
      confirmed: true,
      source: {
        name: 'Spectrum: 2026 Buy Back Token Schedule',
        url: 'https://robertsspaceindustries.com/spectrum/community/SC/forum/1/thread/2026-buy-back-token-schedule',
      },
    });
    expect(renewals[4]!.confirmed).toBe(false);
    expect(renewals[4]!.note?.de).toBe('Geschätzt: der erste Montag des Quartals, wie 2026.');
  });

  it('reads several sources and leaves out what doesn’t fit', () => {
    const renewals = parseTokenRenewals({
      schemaVersion: 1,
      sources: [
        {
          name: 'A',
          url: 'https://a.example',
          renewals: [
            { at: '2027-01-04', confirmed: true, note: 'Announced' },
            { at: 'soon' },
            { at: '2027-04-05T16:00:00Z' },
          ],
        },
        { name: 'No link', renewals: [{ at: '2027-01-04', confirmed: true }] },
        { name: 'Insecure', url: 'http://b.example', renewals: [{ at: '2027-01-04' }] },
        { name: 'B', url: 'https://b.example', renewals: [{ at: '2026-12-01', confirmed: 'yes' }] },
      ],
    })!;
    expect(renewals.map((r) => [r.source.name, r.at.at, r.confirmed, r.note?.en])).toEqual([
      ['A', at('2027-01-04T00:00:00Z'), true, 'Announced'],
      // Without `confirmed: true` an estimate.
      ['A', at('2027-04-05T16:00:00Z'), false, undefined],
      ['B', at('2026-12-01T00:00:00Z'), false, undefined],
    ]);
  });

  it('keeps the stored ones for a file it can’t read', () => {
    expect(parseTokenRenewals(undefined)).toBeUndefined();
    expect(parseTokenRenewals({ schemaVersion: 2, sources: [] })).toBeUndefined();
    expect(parseTokenRenewals({ schemaVersion: 1 })).toBeUndefined();
    expect(parseTokenRenewals({ schemaVersion: 1, sources: [] })).toEqual([]);
  });

  it('chooses the earliest date not over yet, of every source', () => {
    const renewals = parseTokenRenewals({
      schemaVersion: 1,
      sources: [
        {
          name: 'Late',
          url: 'https://a.example',
          renewals: [{ at: '2027-04-05', confirmed: true }],
        },
        {
          name: 'Early',
          url: 'https://b.example',
          renewals: [{ at: '2026-10-05', confirmed: true }, { at: '2027-01-04' }],
        },
        {
          name: 'Same',
          url: 'https://c.example',
          renewals: [{ at: '2027-01-04', confirmed: true }],
        },
      ],
    })!;
    // A day counts until it is over.
    expect(nextTokenRenewal(renewals, at('2026-10-05T23:00:00Z'))?.source.name).toBe('Early');
    // Confirmed before an estimate of the same day.
    const next = nextTokenRenewal(renewals, at('2026-10-06T00:00:00Z'))!;
    expect([next.source.name, next.confirmed]).toEqual(['Same', true]);
    // Past dates only: none.
    expect(nextTokenRenewal(renewals, at('2027-04-05T00:00:00Z') + DAY)).toBeUndefined();
  });
});

describe('the text of a renewal (#434)', () => {
  it('says whether it is announced or estimated, with note and source', async () => {
    const { renewalText } = await import('./renewal-text');
    const [first, , , , estimate] = parseTokenRenewals(file)!;
    expect(renewalText(first!, 'en')).toBe(
      'RSI renews the tokens on January 5, 2026.\nSource: Spectrum: 2026 Buy Back Token Schedule',
    );
    expect(renewalText(estimate!, 'en')).toBe(
      'RSI probably renews the tokens on January 4, 2027 (estimated).\n' +
        'Estimated: the first Monday of the quarter, as in 2026.\n' +
        'Source: Spectrum: 2026 Buy Back Token Schedule',
    );
  });
});

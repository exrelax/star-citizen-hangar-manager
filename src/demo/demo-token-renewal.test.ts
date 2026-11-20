import { describe, expect, it } from 'vitest';
import { demoTokenRenewal, nextQuarterMonday } from './demo-token-renewal';

describe('the demo’s renewal of the buy back tokens (#434)', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');

  it('finds the first Monday of the next quarter', () => {
    expect(new Date(nextQuarterMonday(now)).toISOString()).toBe('2027-01-04T00:00:00.000Z');
    expect(new Date(nextQuarterMonday(Date.parse('2026-02-01'))).toISOString()).toBe(
      '2026-04-06T00:00:00.000Z',
    );
  });

  it('shows the website’s date, none, or one of its own', () => {
    expect(demoTokenRenewal('real', undefined, now)).toBeUndefined();
    expect(demoTokenRenewal('none', undefined, now)).toBeNull();
    const confirmed = demoTokenRenewal('confirmed', undefined, now)!;
    expect([confirmed.confirmed, confirmed.note]).toEqual([true, undefined]);
    const estimated = demoTokenRenewal('estimated', undefined, now)!;
    expect(estimated.confirmed).toBe(false);
    expect(estimated.note?.en).toMatch(/^Estimated/);
    expect(estimated.source.url).toMatch(/^https:\/\/robertsspaceindustries\.com\/spectrum\//);
  });
});

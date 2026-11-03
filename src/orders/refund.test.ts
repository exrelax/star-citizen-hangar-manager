import { describe, expect, it } from 'vitest';
import { localToday, refundRequestUrl, refundWindow } from './refund';

describe('refundWindow', () => {
  it('counts the days left of the 30 days after the purchase', () => {
    expect(refundWindow('2026-10-30', '2026-11-03')).toEqual({ daysLeft: 26, until: '2026-11-29' });
    expect(refundWindow('2026-10-30', '2026-11-29')).toEqual({ daysLeft: 0, until: '2026-11-29' });
  });

  it('is over afterwards, and for dates it cannot read', () => {
    expect(refundWindow('2026-10-30', '2026-11-30')).toBeUndefined();
    expect(refundWindow('', '2026-11-03')).toBeUndefined();
  });
});

describe('localToday', () => {
  it('gives the local date', () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('refundRequestUrl', () => {
  it('fills in RSI support form for a refund of the order, in English', () => {
    const url = new URL(refundRequestUrl('RW03H4EVI8ZF1'));
    expect(url.origin + url.pathname).toBe(
      'https://support.robertsspaceindustries.com/hc/en-us/requests/new',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ticket_form_id: '360000663594',
      tf_360014846974: 'other_ship_or_pledge_query',
      tf_subject: 'Refund Request for Order RW03H4EVI8ZF1',
      tf_description:
        '<p>Hello Support Team,<br>' +
        'I am submitting a refund request for order RW03H4EVI8ZF1.<br>' +
        'Please let me know when I can expect to receive the refund.<br>' +
        'Thank you very much and best regards</p>',
    });
  });
});

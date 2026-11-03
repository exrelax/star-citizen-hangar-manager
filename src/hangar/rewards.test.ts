import { describe, expect, it } from 'vitest';
import { isRewardTitle, rewardKind } from './rewards';

const kind = (title: string, value = '$0.00 USD') =>
  rewardKind({ title, value, valueUsd: Number(value.replace(/[^\d.]/g, '')) || 0 });

describe('rewardKind', () => {
  it('ignores pledges with a value', () => {
    expect(kind('Luminalia 2955 Day 7', '$5.00 USD')).toBeUndefined();
    expect(kind('Standalone Ship - MPUV Tractor plus VIP paint', '$35.00 USD')).toBeUndefined();
    expect(kind('Something', '')).toBeUndefined();
  });

  it('recognizes concierge rewards', () => {
    expect(kind('VIP Wing Commander')).toBe('concierge');
    expect(kind('Artimex Armor - Chairman’s Club Edition')).toBe('concierge');
    expect(kind("Chairman's Club Coin Case")).toBe('concierge');
  });

  it('recognizes event rewards', () => {
    expect(kind('Luminalia 2955 Day 7')).toBe('event');
    expect(kind('2954 BIS F8C Lightning Reward')).toBe('event');
    expect(kind('ArcCorp Resource Drive Reward')).toBe('event');
    expect(kind('Silverton Jacket AA Defense')).toBe('event');
    expect(kind('Year of the Rat Envelope')).toBe('event');
  });

  it('treats other free pledges as other rewards', () => {
    expect(kind('3.18 Referral Reward - Merlin')).toBe('other');
    expect(kind('Star Kitten Helmet - Centurion')).toBe('other');
  });
});

describe('isRewardTitle', () => {
  it('recognizes rewards by their names', () => {
    expect(isRewardTitle('Luminalia 2952 Argo MPUV - Referral')).toBe(true);
    expect(isRewardTitle('3.18 Referral Reward - Merlin')).toBe(true);
    expect(isRewardTitle('RSI Disc. Defense Tier 3 Reward')).toBe(true);
    expect(isRewardTitle('Standalone Ship - F8C Lightning')).toBe(false);
  });
});

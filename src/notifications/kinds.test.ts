import { describe, expect, it } from 'vitest';
import { isKindOn, notificationKindsOf, withKind } from './kinds';

describe('notification kinds', () => {
  it('keeps only known kinds, once each', () => {
    expect(notificationKindsOf(['storeItems', 'old', 'storeItems', 'meltReady'])).toEqual([
      'meltReady',
      'storeItems',
    ]);
    expect(notificationKindsOf('meltReady')).toEqual([]);
  });

  it('turns a kind on and off', () => {
    expect(withKind([], 'warbonds', false)).toEqual(['warbonds']);
    expect(withKind(['warbonds'], 'warbonds', true)).toEqual([]);
    expect(isKindOn(['warbonds'], 'warbonds')).toBe(false);
    expect(isKindOn(['warbonds'], 'meltReady')).toBe(true);
  });
});

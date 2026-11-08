import { describe, expect, it } from 'vitest';
import { fitsWindow } from './stick-while-fits';

describe('fitsWindow', () => {
  it('fits with room to the bottom edge', () => {
    expect(fitsWindow(72, 400, 800)).toBe(true);
    expect(fitsWindow(72, 712, 800)).toBe(true);
  });

  it("doesn't fit once it would reach the bottom edge", () => {
    expect(fitsWindow(72, 713, 800)).toBe(false);
    expect(fitsWindow(72, 900, 800)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { popoverPlacement } from './rsi-popover';

/* Where the choice of watchlists of a button on RSI's pages opens (#632). */

const view = { width: 1200, height: 800 };
const size = { width: 380, height: 200 };
const button = (top: number, left = 700, width = 220, height = 48) => ({
  top,
  left,
  right: left + width,
  bottom: top + height,
});

describe('popoverPlacement', () => {
  it('grows down from the button, aligned to its right edge', () => {
    expect(popoverPlacement(button(300), size, view, 'below')).toEqual({
      left: 540,
      top: 300,
      side: 'below',
    });
  });

  it('grows up from the button where it prefers to, e.g. the upgrade dialog’s bar', () => {
    expect(popoverPlacement(button(720), size, view, 'above')).toEqual({
      left: 540,
      top: 568,
      side: 'above',
    });
  });

  it('flips to the other side without room, and stays in the window', () => {
    expect(popoverPlacement(button(700), size, view, 'below').side).toBe('above');
    expect(popoverPlacement(button(20), size, view, 'above').side).toBe('below');
    expect(popoverPlacement(button(300, 10, 52), size, view, 'below').left).toBe(8);
    expect(popoverPlacement(button(300), size, { width: 360, height: 800 }, 'below').left).toBe(8);
  });
});

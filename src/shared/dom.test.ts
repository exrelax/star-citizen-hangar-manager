// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { isPlainLeftClick } from './dom';

describe('isPlainLeftClick', () => {
  it('accepts a plain left click', () => {
    expect(isPlainLeftClick(new MouseEvent('click', { button: 0 }))).toBe(true);
  });

  it.each([
    { button: 1 },
    { button: 0, ctrlKey: true },
    { button: 0, metaKey: true },
    { button: 0, shiftKey: true },
    { button: 0, altKey: true },
  ])('rejects %o', (init) => {
    expect(isPlainLeftClick(new MouseEvent('click', init))).toBe(false);
  });
});

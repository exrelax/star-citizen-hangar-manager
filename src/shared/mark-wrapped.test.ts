// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { markWrapped } from './mark-wrapped';

/** A row whose items start at these tops (happy-dom does no layout). */
function row(tops: number[]): HTMLElement {
  const element = document.createElement('div');
  for (const top of tops) {
    const item = document.createElement('button');
    Object.defineProperty(item, 'offsetTop', { get: () => top, configurable: true });
    element.append(item);
  }
  return element;
}

describe('markWrapped', () => {
  it('marks a row whose items went to the next line', () => {
    const element = row([0, 30]);
    markWrapped(element);
    expect(element.classList.contains('is-wrapped')).toBe(true);
  });

  it('leaves a row on one line unmarked, also after it was marked', () => {
    const element = row([0, 0]);
    element.classList.add('is-wrapped');
    markWrapped(element);
    expect(element.classList.contains('is-wrapped')).toBe(false);
  });

  it('measures without the class, so the row can widen again', () => {
    const element = row([0, 0]);
    let measuredWith: boolean | undefined;
    Object.defineProperty(element.children[1], 'offsetTop', {
      get: () => {
        measuredWith = element.classList.contains('is-wrapped');
        return 0;
      },
    });
    element.classList.add('is-wrapped');
    markWrapped(element);
    expect(measuredWith).toBe(false);
  });
});

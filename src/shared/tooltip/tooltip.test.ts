// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, withDirectives, type App } from 'vue';
import { hideTooltip, SHOW_DELAY_MS, tooltipState, vTooltip, type TooltipValue } from './tooltip';

let app: App | undefined;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  app?.unmount();
  hideTooltip();
  vi.useRealTimers();
});

function render(value: TooltipValue, text = '') {
  const tooltip = ref(value);
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({
    render: () => withDirectives(h('button', text), [[vTooltip, tooltip.value]]),
  });
  app.mount(root);
  return { button: root.querySelector('button')!, tooltip };
}

const overlay = () => document.querySelector<HTMLElement>('.shm-tooltip');
const pointer = (type: string, pointerType = 'mouse') =>
  Object.assign(new Event(type), { pointerType });

describe('vTooltip', () => {
  it('names an icon button, and describes an element with text', () => {
    expect(render('Refresh').button.getAttribute('aria-label')).toBe('Refresh');
    app?.unmount();
    const { button } = render({ title: 'Protected', text: 'Explained.' }, 'SC');
    expect(button.getAttribute('aria-label')).toBeNull();
    expect(button.getAttribute('aria-description')).toBe('Protected – Explained.');
    expect(button.getAttribute('title')).toBeNull();
  });

  it('shows after a short delay under the mouse and hides when it leaves', async () => {
    const { button } = render('Refresh');
    button.dispatchEvent(pointer('pointerenter'));
    expect(tooltipState.anchor).toBeUndefined();
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    await nextTick();
    expect(tooltipState.anchor).toBe(button);
    expect(overlay()?.textContent).toBe('Refresh');
    expect(overlay()?.getAttribute('role')).toBe('tooltip');

    button.dispatchEvent(pointer('pointerleave'));
    await nextTick();
    expect(overlay()).toBeNull();
  });

  it('ignores touch, hides on a click and follows a changed text', async () => {
    const { button, tooltip } = render('Refresh');
    button.dispatchEvent(pointer('pointerenter', 'touch'));
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    expect(tooltipState.anchor).toBeUndefined();

    button.dispatchEvent(pointer('pointerenter'));
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    tooltip.value = 'Updating …';
    await nextTick();
    expect(tooltipState.content?.text).toBe('Updating …');
    expect(button.getAttribute('aria-label')).toBe('Updating …');

    button.dispatchEvent(pointer('pointerdown'));
    expect(tooltipState.anchor).toBeUndefined();
  });

  it('shows nothing without a text', () => {
    const { button } = render(undefined, 'Invoice');
    button.dispatchEvent(pointer('pointerenter'));
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    expect(tooltipState.anchor).toBeUndefined();
    expect(button.getAttribute('aria-description')).toBeNull();
  });
});

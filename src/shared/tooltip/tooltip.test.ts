// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, withDirectives, type App } from 'vue';
import {
  HIDE_DELAY_MS,
  hideTooltip,
  SHOW_DELAY_MS,
  showTooltip,
  tooltipState,
  vTooltip,
  type TooltipValue,
} from './tooltip';

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

describe('toContent with a card (#426)', () => {
  it('keeps the card with its text as the description', async () => {
    const { toContent } = await import('./tooltip');
    const component = { render: () => null };
    const content = toContent({ text: 'Pledge #1', card: { component, props: { a: 1 } } });
    expect(content?.text).toBe('Pledge #1');
    expect(content?.card?.props).toEqual({ a: 1 });
    expect(toContent({ text: '', card: { component, props: {} } })).toBeUndefined();
  });
});

describe('an interactive tooltip (#434)', () => {
  const card = {
    component: {
      render: () => h('p', ['Next: ', h('a', { href: 'https://a.example' }, 'Source')]),
    },
    props: {},
  };
  const value = { text: 'Tokens: 0', card, interactive: true };
  const link = () => overlay()?.querySelector('a');

  it('stays open on the way to it and while the mouse is over it', async () => {
    const { button } = render(value, 'Tokens');
    button.dispatchEvent(pointer('pointerenter'));
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    await nextTick();
    expect(overlay()?.getAttribute('role')).toBe('dialog');
    expect(overlay()?.classList.contains('is-interactive')).toBe(true);

    button.dispatchEvent(pointer('pointerleave'));
    await nextTick();
    expect(overlay()).not.toBeNull();
    overlay()!.dispatchEvent(pointer('pointerenter'));
    vi.advanceTimersByTime(HIDE_DELAY_MS * 2);
    await nextTick();
    expect(overlay()).not.toBeNull();

    overlay()!.dispatchEvent(pointer('pointerleave'));
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    await nextTick();
    expect(overlay()).toBeNull();
  });

  it('takes Tab into its link, and Escape back to its element', async () => {
    const { button } = render(value, 'Tokens');
    showTooltip(button);
    await nextTick();
    await nextTick();
    button.focus();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(link());

    link()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(overlay()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('closes when Tab leaves its last control', async () => {
    const { button } = render(value, 'Tokens');
    showTooltip(button);
    await nextTick();
    await nextTick();
    link()!.focus();
    link()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await nextTick();
    expect(overlay()).toBeNull();
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import SelectMenu from './SelectMenu.vue';

let app: App | undefined;
afterEach(() => app?.unmount());

const OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'valueDesc', label: 'Highest value first' },
];

function render() {
  const value = ref('newest');
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({
    render: () =>
      h(SelectMenu, {
        options: OPTIONS,
        modelValue: value.value,
        label: 'Sort',
        'onUpdate:modelValue': (next: string) => (value.value = next),
      }),
  });
  app.mount(root);
  const button = root.querySelector('button')!;
  const list = () => root.querySelector<HTMLElement>('[role=listbox]');
  const key = (target: HTMLElement, name: string) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  return { value, button, list, key };
}

describe('SelectMenu', () => {
  it('shows the selected option as text and names it for screen readers', () => {
    const { button } = render();
    expect(button.textContent?.trim()).toBe('Newest first');
    expect(button.getAttribute('aria-label')).toBe('Sort: Newest first');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens with the keyboard, moves with the arrows and chooses with Enter', async () => {
    const { value, button, list, key } = render();
    key(button, 'ArrowDown');
    await nextTick();
    expect(list()).not.toBeNull();
    expect(list()!.querySelector('[aria-selected=true]')?.textContent?.trim()).toBe('Newest first');

    key(list()!, 'ArrowDown');
    key(list()!, 'ArrowDown');
    key(list()!, 'Enter');
    await nextTick();
    expect(value.value).toBe('valueDesc');
    expect(list()).toBeNull();
  });

  it('closes with Escape without changing the order, and jumps by first letter', async () => {
    const { value, button, list, key } = render();
    button.click();
    await nextTick();
    key(list()!, 'o');
    key(list()!, 'Escape');
    await nextTick();
    expect(list()).toBeNull();
    expect(value.value).toBe('newest');

    button.click();
    await nextTick();
    key(list()!, 'o');
    key(list()!, ' ');
    await nextTick();
    expect(value.value).toBe('oldest');
  });
});

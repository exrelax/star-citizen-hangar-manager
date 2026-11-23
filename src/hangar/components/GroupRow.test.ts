// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import type { ItemGroup } from '../grouping';
import GroupRow from './GroupRow.vue';

/* Expanding a group in place or opening its dialog (#488). */

type Item = { id: number; title: string };
let app: App | undefined;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

const group: ItemGroup<Item> = {
  key: 'a',
  items: [
    { id: 1, title: 'Upgrade - Nova to RAFT' },
    { id: 2, title: 'Upgrade - Nova to RAFT' },
  ],
  count: 2,
  value: { total: 10, unknown: 0 },
  discount: { total: 0, unknown: 0 },
  giftable: 'all',
  extras: [],
};

function render(open: { id: number; at: number } | null = null, withHead = false) {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({
    render: () =>
      h(
        GroupRow<Item>,
        { group, badges: [], open },
        {
          item: ({ entry }: { entry: Item }) => h('div', { class: 'item' }, String(entry.id)),
          ...(withHead ? { head: () => h('p', { class: 'head' }, 'Base ship') } : {}),
        },
      ),
  });
  app.mount(root);
  return root;
}
const inList = (root: HTMLElement) => root.querySelectorAll('.shm-group-items .item').length;
const dialog = () => document.querySelector('.shm-group-dialog');

describe('GroupRow (#488)', () => {
  it('expands in place with a click and collapses with a second', async () => {
    const root = render();
    const chevron = root.querySelector<HTMLButtonElement>('.shm-chevron:not(.shm-group-open)')!;
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    root.querySelector<HTMLElement>('.shm-row-summary')!.click();
    await nextTick();
    expect(inList(root)).toBe(2);
    expect(chevron.getAttribute('aria-expanded')).toBe('true');
    expect(dialog()).toBeNull();
    chevron.click();
    await nextTick();
    expect(inList(root)).toBe(0);
  });

  it('shows what the whole group has inside its own box while expanded (#615)', async () => {
    const root = render(null, true);
    expect(root.querySelector('.head')).toBeNull();
    root.querySelector<HTMLElement>('.shm-row-summary')!.click();
    await nextTick();
    expect(root.querySelector('.shm-group-row .shm-group-head .head')).not.toBeNull();
    expect(root.querySelector('.shm-group-items .head')).toBeNull();
    expect(inList(root)).toBe(2);
    root.querySelector<HTMLElement>('.shm-row-summary')!.click();
    await nextTick();
    expect(root.querySelector('.head')).toBeNull();
  });

  it('opens its dialog with its own button, not expanding it', async () => {
    const root = render();
    const button = root.querySelector<HTMLButtonElement>('.shm-group-open')!;
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-label')).toBe('Open the group in a dialog');
    button.click();
    await nextTick();
    expect(dialog()?.querySelectorAll('.item').length).toBe(2);
    expect(inList(root)).toBe(0);
  });

  it('opens its dialog for a jump to one of its pledges', async () => {
    render({ id: 2, at: 1 });
    await nextTick();
    expect(dialog()?.querySelector('.is-highlighted')?.textContent).toBe('2');
  });
});

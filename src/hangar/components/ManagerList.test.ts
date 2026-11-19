// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import type { FilterRefinements } from '../filters';
import ManagerList from './ManagerList.vue';

/* A filter pill's finer choice while the filter is included (#419). */

type Entry = { id: number; searchText: string; paint: boolean; owned: boolean };
type F = 'paints' | 'owned';

let app: App | undefined;
afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

const entries: Entry[] = [
  { id: 1, searchText: 'a', paint: true, owned: true },
  { id: 2, searchText: 'b', paint: true, owned: false },
  { id: 3, searchText: 'c', paint: true, owned: true },
  { id: 4, searchText: 'd', paint: false, owned: true },
];
const refinements: FilterRefinements<Entry, F> = {
  paints: [
    { id: 'all', label: 'All paints' },
    { id: 'owned', label: 'For owned ships', short: 'Owned ships', matches: (e) => e.owned },
    {
      id: 'notOwned',
      label: 'For ships not owned',
      short: 'Ships not owned',
      matches: (e) => !e.owned,
    },
  ],
};

function render() {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({
    render: () =>
      h(
        ManagerList<Entry, F, string>,
        {
          entries,
          filterGroups: [{ category: 'types', filters: ['paints', 'owned'] }],
          predicates: { paints: (e: Entry) => e.paint, owned: (e: Entry) => e.owned },
          refinements,
          filterLabel: (filter: F) => (filter === 'paints' ? 'Paints' : 'Owned'),
          active: false,
        },
        { row: ({ entry }: { entry: Entry }) => h('div', { class: 'row' }, String(entry.id)) },
      ),
  });
  app.mount(root);
  return root;
}

const pill = (root: HTMLElement) => root.querySelector<HTMLElement>('.shm-filter-pill')!;
const main = (root: HTMLElement) => pill(root).querySelector<HTMLButtonElement>('.shm-filter')!;
const chevron = (root: HTMLElement) =>
  pill(root).querySelector<HTMLButtonElement>('.shm-filter-refine');
const rows = (root: HTMLElement) => [...root.querySelectorAll('.row')].map((r) => r.textContent);
const counts = (root: HTMLElement) =>
  [...root.querySelectorAll('.shm-filter-count')].map((c) => c.textContent);

async function choose(root: HTMLElement, label: string) {
  chevron(root)!.click();
  await nextTick();
  const option = [...root.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (o) => o.textContent?.trim() === label,
  )!;
  option.click();
  await nextTick();
}

describe('ManagerList: refined filters (#419)', () => {
  it('offers the finer choice only while the filter is included', async () => {
    const root = render();
    expect(chevron(root)).toBeNull();
    main(root).click();
    await nextTick();
    expect(main(root).getAttribute('aria-pressed')).toBe('true');
    expect(chevron(root)?.getAttribute('aria-haspopup')).toBe('listbox');
    expect(chevron(root)?.getAttribute('aria-label')).toBe('Refine “Paints”: All paints');
  });

  it('narrows the list and the counts down, and shows the choice in the pill', async () => {
    const root = render();
    main(root).click();
    await nextTick();
    expect(rows(root)).toEqual(['1', '2', '3']);

    chevron(root)!.click();
    await nextTick();
    expect([...root.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim())).toEqual(
      ['All paints', 'For owned ships', 'For ships not owned'],
    );
    root.querySelectorAll<HTMLElement>('[role="option"]')[2]!.click();
    await nextTick();
    expect(rows(root)).toEqual(['2']);
    expect(pill(root).querySelector('.shm-filter-label')?.textContent).toBe(
      'Paints · Ships not owned',
    );
    expect(counts(root)).toEqual(['1', '0']);

    await choose(root, 'For owned ships');
    expect(rows(root)).toEqual(['1', '3']);
    expect(counts(root)).toEqual(['2', '2']);

    await choose(root, 'All paints');
    expect(pill(root).querySelector('.shm-filter-label')?.textContent).toBe('Paints');
    expect(rows(root)).toEqual(['1', '2', '3']);
  });

  it('goes back to "all" once the filter is excluded or turned off', async () => {
    const root = render();
    main(root).click();
    await nextTick();
    await choose(root, 'For owned ships');
    // Excluded: no chevron, no choice; all paints are hidden.
    main(root).click();
    await nextTick();
    expect(chevron(root)).toBeNull();
    expect(pill(root).querySelector('.shm-filter-label')?.textContent).toBe('Paints');
    expect(rows(root)).toEqual(['4']);
    // Off, then included again: "all" again.
    main(root).click();
    await nextTick();
    main(root).click();
    await nextTick();
    expect(rows(root)).toEqual(['1', '2', '3']);
    expect(pill(root).querySelector('.shm-filter-label')?.textContent).toBe('Paints');
  });

  it('leaves filters without a refinement as they are', async () => {
    const root = render();
    const other = root.querySelectorAll<HTMLElement>('.shm-filter-pill')[1]!;
    other.querySelector<HTMLButtonElement>('.shm-filter')!.click();
    await nextTick();
    expect(other.querySelector('.shm-filter-refine')).toBeNull();
    expect(rows(root)).toEqual(['1', '3', '4']);
  });
});

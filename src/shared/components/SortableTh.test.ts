// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, type App } from 'vue';
import type { TableSort } from '../table-sort';
import SortableTh from './SortableTh.vue';

/* A sortable column head (#395). */

let app: App | undefined;
afterEach(() => app?.unmount());

function mount(sort: TableSort | null, onSort: (column: string) => void = () => {}) {
  const root = document.createElement('table');
  app = createApp({
    render: () =>
      h(
        'thead',
        h(
          'tr',
          h(SortableTh, { column: 'value', sort, numeric: true, onSort }, () => 'Value'),
        ),
      ),
  });
  app.mount(root);
  return root.querySelector('th')!;
}

describe('SortableTh', () => {
  it('is a button that asks to sort by its column', () => {
    const sorted: string[] = [];
    const head = mount(null, (column) => sorted.push(column));
    expect(head.getAttribute('aria-sort')).toBe('none');
    expect(head.querySelector('.shm-sort-arrow')).toBeNull();
    head.querySelector('button')!.click();
    expect(sorted).toEqual(['value']);
  });

  it('shows the direction of its column with an arrow and aria-sort', () => {
    const down = mount({ column: 'value', direction: 'desc' });
    expect(down.getAttribute('aria-sort')).toBe('descending');
    expect(down.querySelector('use')?.getAttribute('href')).toContain('arrow-down');
    app!.unmount();
    const up = mount({ column: 'value', direction: 'asc' });
    expect(up.getAttribute('aria-sort')).toBe('ascending');
    expect(up.querySelector('use')?.getAttribute('href')).toContain('arrow-up');
    app!.unmount();
    expect(mount({ column: 'count', direction: 'asc' }).getAttribute('aria-sort')).toBe('none');
  });
});

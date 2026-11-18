// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, type App } from 'vue';
import type { RemovalCcus } from '../removal-ccus';
import RemovalCcuTable from './RemovalCcuTable.vue';

/* The CCUs from and to a ship leaving the Pledge Store, expanded in the Pledge Store tab (#380). */

const removal = {
  ship: { id: 45, name: 'Constellation Mk IV Andromeda' },
  removedAt: { at: Date.parse('2027-01-27T00:00:00Z'), dayOnly: true as const },
  source: 'https://robertsspaceindustries.com/en/comm-link/transmission/21350',
};
const ccus = (hangar: number, buyback: number) => [
  ...Array.from({ length: hangar }, (_, i) => ({ source: 'hangar' as const, id: i, title: '' })),
  ...Array.from({ length: buyback }, (_, i) => ({ source: 'buyback' as const, id: i, title: '' })),
];

let app: App | undefined;
afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.innerHTML = '';
});

function mount(entry: RemovalCcus) {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({ render: () => h(RemovalCcuTable, { entry }) });
  app.mount(root);
  const cells = [...root.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('th, td')].map((cell) => cell.textContent?.trim()),
  );
  return { root, cells, summary: root.querySelector('.shm-removal-summary')?.textContent?.trim() };
}

describe('RemovalCcuTable', () => {
  it('counts the CCUs from and to the ship, in the hangar and the buy back', () => {
    const { cells, summary } = mount({
      removal,
      from: ccus(2, 0),
      to: ccus(1, 2),
      level: 'warning',
    });
    expect(cells).toEqual([
      ['CCUs from it', '2', '–', '2'],
      ['CCUs to it', '1', '2', '3'],
    ]);
    expect(summary).toBe(
      'Enough: for every CCU from the Constellation Mk IV Andromeda in your hangar there is a CCU to it.',
    );
  });

  it('tells how many CCUs to the ship are missing, and until when', () => {
    const { root, summary } = mount({
      removal,
      from: ccus(3, 1),
      to: ccus(1, 0),
      level: 'critical',
    });
    expect(summary).toBe(
      '2 CCUs to the Constellation Mk IV Andromeda are missing for the CCUs from it in your hangar. Secure them before Jan 27, 2027.',
    );
    expect(root.querySelector('.shm-removal-summary')?.classList).toContain('is-critical');
  });

  it('says so instead of a table without any CCUs, or without CCUs from the ship', () => {
    const none = mount({ removal, from: [], to: [] });
    expect(none.root.querySelector('table')).toBeNull();
    expect(none.summary).toBe('You have no CCUs from or to the Constellation Mk IV Andromeda.');
    app?.unmount();
    const toOnly = mount({ removal, from: ccus(0, 2), to: ccus(1, 0) });
    expect(toOnly.summary).toBe(
      'You have no CCUs from the Constellation Mk IV Andromeda in your hangar: nothing to secure.',
    );
  });
});

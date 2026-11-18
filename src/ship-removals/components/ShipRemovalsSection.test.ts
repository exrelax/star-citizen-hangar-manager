// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import type { ShipRemoval } from '../ship-removals';
import ShipRemovalsSection from './ShipRemovalsSection.vue';

/* The section of the Pledge Store tab with the ships leaving it (#288). */

const NOW = Date.parse('2027-01-27T15:20:00Z');
const SOURCE = 'https://robertsspaceindustries.com/en/comm-link/transmission/21350';
const removal = (id: number, name: string, at: string, dayOnly?: true): ShipRemoval => ({
  ship: { id, name },
  removedAt: { at: Date.parse(at), ...(dayOnly && { dayOnly }) },
  source: SOURCE,
});

let app: App | undefined;
beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: NOW }));
afterEach(() => {
  app?.unmount();
  app = undefined;
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function mount(removals: ShipRemoval[]) {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({ render: () => h(ShipRemovalsSection, { removals, ships: [] }) });
  app.mount(root);
  return root;
}

describe('ShipRemovalsSection', () => {
  it('lists the ships by date, each with its countdown and source', () => {
    const root = mount([
      removal(45, 'Constellation Mk IV Andromeda', '2027-01-27T00:00:00Z', true),
      removal(47, 'Constellation Mk IV Aquila', '2027-01-27T00:00:00Z', true),
      removal(15, 'F7C-M Super Hornet Mk I', '2027-01-27T16:00:00Z'),
    ]);
    expect(root.querySelector('#shm-store-removals-title')).not.toBeNull();
    const headings = [...root.querySelectorAll('h4')].map((heading) => heading.textContent?.trim());
    expect(headings).toHaveLength(2);
    expect(headings[1]).toMatch(/2 ships$/);
    const rows = [...root.querySelectorAll('.shm-removal')];
    expect(rows.map((row) => row.querySelector('.shm-title')?.textContent)).toEqual([
      'F7C-M Super Hornet Mk I',
      'Constellation Mk IV Andromeda',
      'Constellation Mk IV Aquila',
    ]);
    // The last hour counts the seconds, a day without a time names the day.
    expect(rows[0]!.querySelector('.shm-badge')?.textContent?.trim()).toBe('Removal: 40:00');
    expect(rows[1]!.querySelector('.shm-badge')?.textContent?.trim()).toBe('Removal: today');
    expect(rows[1]!.querySelector('a')?.getAttribute('href')).toBe(SOURCE);
  });

  it('opens a ship with a click on its row, and closes it again', async () => {
    const root = mount([
      removal(45, 'Constellation Mk IV Andromeda', '2027-01-27T00:00:00Z', true),
    ]);
    const row = root.querySelector('.shm-removal')!;
    (row.querySelector('.shm-row-summary') as HTMLElement).click();
    await nextTick();
    expect(row.querySelector('.shm-removal-details')).not.toBeNull();
    expect(row.querySelector('.shm-chevron')?.getAttribute('aria-expanded')).toBe('true');
    (row.querySelector('.shm-chevron') as HTMLElement).click();
    await nextTick();
    expect(row.querySelector('.shm-removal-details')).toBeNull();
  });

  it('shows nothing without upcoming removals', () => {
    const root = mount([
      removal(45, 'Constellation Mk IV Andromeda', '2027-01-20T00:00:00Z', true),
    ]);
    expect(root.querySelector('section')).toBeNull();
  });
});

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createApp, h, nextTick, shallowRef, type App } from 'vue';
import { DEMO_CONTEXT, type DemoContext } from '@/demo/use-demo';
import { buyableShipsItem, SHIPS_VERSION, warbondsItem } from '@/ships/ships-storage';
import type { ShipRemoval } from '../ship-removals';
import { openShipRemoval, shipRemovalRequest } from '@/store/open-current-warbonds';
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

function mount(removals: ShipRemoval[], demo = false) {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({ render: () => h(ShipRemovalsSection, { removals, ships: [] }) });
  app.provide(DEMO_CONTEXT, shallowRef(demo ? ({} as DemoContext) : null));
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

  it('expands a ship opened from My Hangar (#381), also with another one open', async () => {
    const root = mount([
      removal(45, 'Constellation Mk IV Andromeda', '2027-01-27T00:00:00Z', true),
      removal(47, 'Constellation Mk IV Aquila', '2027-01-27T00:00:00Z', true),
    ]);
    const [andromeda, aquila] = [...root.querySelectorAll('.shm-removal')];
    (andromeda!.querySelector('.shm-row-summary') as HTMLElement).click();
    openShipRemoval(47);
    await nextTick();
    expect(location.hash).toBe('#hangar-manager-store');
    expect(aquila!.id).toBe('shm-store-removal-47');
    expect(aquila!.querySelector('.shm-removal-details')).not.toBeNull();
    expect(andromeda!.querySelector('.shm-removal-details')).not.toBeNull();
    expect(shipRemovalRequest.value).toBeUndefined();
  });

  it('expands a ship requested before the section was built (#381)', async () => {
    shipRemovalRequest.value = { shipId: 45 };
    const root = mount([
      removal(45, 'Constellation Mk IV Andromeda', '2027-01-27T00:00:00Z', true),
    ]);
    await nextTick();
    expect(root.querySelector('#shm-store-removal-45 .shm-removal-details')).not.toBeNull();
  });

  it("opens RSI's ship upgrade dialog for a ship on sale, with its standard SKU (#391)", async () => {
    fakeBrowser.reset();
    await buyableShipsItem.setValue({
      version: SHIPS_VERSION,
      skus: [
        { shipId: 45, skuId: 900, title: 'Warbond Edition', price: 300 },
        { shipId: 45, skuId: 901, title: 'Standard Edition', price: 350 },
      ],
    });
    await warbondsItem.setValue({
      version: SHIPS_VERSION,
      warbonds: [{ shipId: 45, skuId: 900, price: 300 }],
    });
    const removals = [
      removal(45, 'Constellation Mk IV Andromeda', '2027-01-27T00:00:00Z', true),
      removal(47, 'Constellation Mk IV Aquila', '2027-01-27T00:00:00Z', true),
    ];
    const root = mount(removals);
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
    const [andromeda, aquila] = [...root.querySelectorAll('.shm-removal')];
    const button = andromeda!.querySelector<HTMLElement>('.js-open-ship-upgrades');
    expect(button?.textContent?.trim()).toBe('Ship upgrade');
    expect(button?.dataset).toMatchObject({
      apiurl: '/pledge-store/api/upgrade/v2',
      toshipid: '45',
      toskuid: '901',
    });
    // Not on sale: no button.
    expect(aquila!.querySelector('.shm-warbond-upgrade')).toBeNull();
    // Its click opens RSI's dialog, not the row.
    button!.click();
    await nextTick();
    expect(andromeda!.querySelector('.shm-removal-details')).toBeNull();

    // In the demo it is disabled: RSI's dialog would show the real account.
    app!.unmount();
    const demo = mount(removals, true);
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
    const disabled = demo.querySelector<HTMLButtonElement>('.shm-warbond-upgrade');
    expect(disabled?.disabled).toBe(true);
    expect(disabled?.classList.contains('js-open-ship-upgrades')).toBe(false);
  });

  it('shows nothing without upcoming removals', () => {
    const root = mount([
      removal(45, 'Constellation Mk IV Andromeda', '2027-01-20T00:00:00Z', true),
    ]);
    expect(root.querySelector('section')).toBeNull();
  });
});

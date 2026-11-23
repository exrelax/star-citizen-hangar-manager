// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, shallowRef, type App } from 'vue';
import { DEFAULT_SETTINGS } from '@/settings/settings';
import type { Ship } from '@/ships/ships';
import { REMOVAL_CCUS, removalCcusState } from '@/ship-removals/use-removal-ccus';
import { ALWAYS_AVAILABLE, type AlwaysAvailableList } from '../always-available';
import { baseShipList, type BaseShipGroup } from '../base-ship-list';
import { chainCoverage } from '../chain-coverage';
import { COVERAGE_SOURCES, type CcuCoverage } from '../coverage';
import CcuDeepView from './CcuDeepView.vue';

/* The deep view's rows and "Secure now" (#563). */

let app: App | undefined;
afterEach(() => app?.unmount());

const ships: Ship[] = [
  { id: 1, name: 'Aurora', msrp: 25 },
  { id: 5, name: 'C1 Spirit', msrp: 125 },
  { id: 2, name: 'Cutlass Red', msrp: 135, link: '/pledge/ships/cutlass-red' },
  { id: 3, name: 'Razor', msrp: 145, link: '/pledge/ships/razor' },
];
const always: AlwaysAvailableList = {
  source: { id: 'wiki', name: 'Star Citizen Wiki', url: 'https://w', facts: [] },
  changedAt: '',
  has: (id) => id === 1,
};
const none = { ships: [], ccus: [] };
const coverage = (id: number, base: number, name: string): CcuCoverage => ({
  id,
  baseShip: { id: base, name },
  hangar: none,
  buyback: none,
  covered: false,
});

function render(coverages: CcuCoverage[], group: BaseShipGroup = 'missing', storeCredit?: number) {
  const root = document.createElement('div');
  document.body.append(root);
  const chains = chainCoverage(coverages, always);
  const list = baseShipList(coverages, always, ships);
  app = createApp({
    render: () =>
      h(CcuDeepView, {
        settings: DEFAULT_SETTINGS,
        list,
        chains,
        group,
        // Only the Cutlass Red is on sale.
        skuOf: (id: number) => (id === 2 ? 902 : undefined),
        ...(storeCredit !== undefined && { storeCredit }),
      }),
  });
  app.provide(ALWAYS_AVAILABLE, shallowRef(always));
  app.provide(REMOVAL_CCUS, shallowRef(removalCcusState([])));
  app.provide(COVERAGE_SOURCES, shallowRef({ hangar: new Map(), buyback: new Map(), ships }));
  app.mount(root);
  return root;
}

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();
/** The texts of an element's parts, apart. */
const parts = (element: Element) =>
  [...element.children]
    .map((part) => text(part))
    .filter(Boolean)
    .join(' ');

describe('CcuDeepView (#563)', () => {
  const ccus = [
    coverage(10, 2, 'Cutlass Red'),
    coverage(11, 2, 'Cutlass Red'),
    coverage(12, 3, 'Razor'),
  ];

  it('sums up what securing the CCUs of the base ships on sale costs', () => {
    const root = render(ccus, 'missing', 143.96);
    const stats = [...root.querySelectorAll('.shm-ccu-deep-stat')].map(parts);
    expect(stats).toEqual([
      'Secure now 2 CCUs on 1 base ship that is on sale now Paid with store credit · yours: $143.96',
      'From the next cheaper always available ship $220 Safe: you can get the start ship any time. 1 base ship',
      'From the next cheaper ship $20 Cheapest – but the start ship may need a way itself',
    ]);
  });

  it('offers both start ships on a row on sale, with "Ship upgrade"', () => {
    const root = render(ccus);
    const [cutlass, razor] = root.querySelectorAll('.shm-ccu-deep-row');
    expect(text(cutlass!.querySelector('.shm-ccu-deep-secure-title'))).toBe('Secure 2 CCUs now');
    expect([...cutlass!.querySelectorAll('.shm-ccu-deep-options li')].map(parts)).toEqual([
      'Aurora → $110 each $220',
      'C1 Spirit → $10 each $20',
    ]);
    const upgrade = cutlass!.querySelector<HTMLAnchorElement>('.js-open-ship-upgrades');
    expect(upgrade?.dataset.toskuid).toBe('902');
    expect(text(upgrade)).toBe('Ship upgrade');

    // Not on sale: the prices each, its page in the Pledge Store.
    expect(text(razor!.querySelector('.shm-ccu-deep-secure-title'))).toBe(
      'Not on sale now – watch for the next sale',
    );
    expect([...razor!.querySelectorAll('.shm-ccu-deep-options li')].map(parts)).toEqual([
      'Aurora → $120 each',
      'Cutlass Red → $10 each',
    ]);
    expect(razor!.querySelector('.js-open-ship-upgrades')).toBeNull();
    expect(razor!.querySelector<HTMLAnchorElement>('.shm-ccu-deep-actions a')?.href).toBe(
      'https://robertsspaceindustries.com/pledge/ships/razor',
    );
  });

  it('shows a chain from an always available ship with its star', () => {
    // CCU 21 from the Cutlass Red, reached by CCU 20 from the always available Aurora.
    const chained: CcuCoverage = {
      ...coverage(21, 2, 'Cutlass Red'),
      hangar: {
        ships: [],
        ccus: [{ source: 'hangar', kind: 'ccu', id: 20, title: 'Upgrade - Aurora to Cutlass Red' }],
      },
      covered: true,
    };
    const root = render(
      [chained, coverage(20, 1, 'Aurora'), coverage(22, 2, 'Cutlass Red')],
      'missing',
    );
    const route = root.querySelector('.shm-ccu-deep-routes li')!;
    expect(parts(route)).toBe('Aurora → ×1');
    expect(route.querySelector('.shm-ccu-deep-star')).not.toBeNull();
    expect(text(root.querySelector('.shm-ccu-deep-count'))).toBe('1 of 2 ways · 1 too few');
    expect(
      [...root.querySelectorAll('.shm-ccu-deep-bar span')].map((segment) => segment.className),
    ).toEqual(['is-chain', 'is-short']);
  });

  it('needs nothing secured for an always available base ship', () => {
    const root = render([coverage(20, 1, 'Aurora')], 'always');
    expect(text(root.querySelector('.shm-ccu-deep-secure-title'))).toBe(
      'Always available – no need to secure it now',
    );
    expect(root.querySelector('.shm-ccu-deep-summary')).toBeNull();
    expect(root.querySelector('.shm-ccu-deep-options')).toBeNull();
  });
});

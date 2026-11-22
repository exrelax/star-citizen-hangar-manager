// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, shallowRef, type App } from 'vue';
import { RSI_GAMES_LIBRARY_URL } from '@/config';
import type { Pledge } from '../pledge';
import { toPledgeView } from '../pledge-view';
import { paintRebuys } from '@/store/paint-consultant/use-paint-consultant';
import { REMOVAL_CCUS, removalCcusState } from '@/ship-removals/use-removal-ccus';
import type { RemovalCcus } from '@/ship-removals/removal-ccus';
import { shipRemovalRequest } from '@/store/open-current-warbonds';
import { ALWAYS_AVAILABLE, type AlwaysAvailableList } from '@/ccu-consultant/always-available';
import { CCU_COVERAGE, COVERAGE_SOURCES, type CcuCoverage } from '@/ccu-consultant/coverage';
import type { Ship } from '@/ships/ships';
import { REBUY_DISPLAY, REBUYABLES, type RebuyDisplay } from '@/melt-rebuy/use-rebuyables';
import type { Rebuy } from '@/melt-rebuy/rebuyable';
import PledgeRow from './PledgeRow.vue';

let app: App | undefined;
afterEach(() => {
  app?.unmount();
  paintRebuys.value = new Map();
});

function render(
  overrides: Partial<Pledge>,
  discountAmount?: number,
  removals: RemovalCcus[] = [],
  consultant?: { coverage: CcuCoverage; list?: AlwaysAvailableList; ships?: Ship[] },
  rebuy?: { entry: Omit<Rebuy, 'pledgeId'>; display: RebuyDisplay },
) {
  const pledge = {
    id: 1,
    name: 'Package - Nomad Star Citizen + Squadron 42 Combo',
    title: 'Package - Nomad Star Citizen + Squadron 42 Combo',
    value: '$115.00 USD',
    valueUsd: 115,
    isGiftable: true,
    isExchangeable: true,
    isUpgraded: false,
    items: [],
    ...overrides,
  } as Pledge;
  const root = document.createElement('div');
  app = createApp({
    render: () =>
      h(PledgeRow, {
        pledge: {
          ...toPledgeView(pledge),
          ...(discountAmount !== undefined && {
            discount: {
              original: 115 + discountAmount,
              paid: 115,
              amount: discountAmount,
              percent: 0,
              ships: [{ name: 'Nomad', price: 115 + discountAmount }],
            },
          }),
        },
        autoExpand: true,
      }),
  });
  app.provide(REMOVAL_CCUS, shallowRef(removalCcusState(removals)));
  if (consultant) {
    app.provide(CCU_COVERAGE, shallowRef(new Map([[pledge.id, consultant.coverage]])));
    app.provide(ALWAYS_AVAILABLE, shallowRef(consultant.list));
    app.provide(
      COVERAGE_SOURCES,
      shallowRef({ hangar: new Map(), buyback: new Map(), ships: consultant.ships ?? [] }),
    );
  }
  if (rebuy) {
    app.provide(
      REBUYABLES,
      shallowRef(new Map([[pledge.id, { pledgeId: pledge.id, ...rebuy.entry }]])),
    );
    app.provide(REBUY_DISPLAY, shallowRef(rebuy.display));
  }
  app.mount(root);
  return root;
}

const badges = (root: HTMLElement) =>
  [...root.querySelectorAll('.shm-badge')].map((badge) => [
    badge.textContent?.trim(),
    badge.classList.contains('is-off'),
  ]);

describe('PledgeRow', () => {
  it('marks a protected pledge with a lock tag and links the Games Library', () => {
    const root = render({
      protectedGames: ['SC', 'SQ42'],
      isGiftable: false,
      isExchangeable: false,
      items: [{ title: 'Nomad', kind: 'Ship' }],
    });

    const lock = root.querySelector('.shm-badge.is-protected');
    expect(lock?.textContent?.trim()).toBe('SC · SQ42');
    expect(lock?.querySelector('.shm-icon')).not.toBeNull();
    // The shared tooltip shows it (see tooltip.test.ts); screen readers get it as description.
    expect(lock?.getAttribute('aria-description')).toBe(
      'Protected game access – RSI protects this pledge as your game access for Star Citizen and ' +
        "Squadron 42. It can't be melted or gifted, but you can still upgrade it with CCUs.",
    );
    // Gift and Melt are struck through, and their buttons are gone.
    expect(badges(root).slice(1)).toEqual([
      ['Gift', true],
      ['Melt', true],
    ]);
    expect(root.querySelector('.shm-exchange-button')).toBeNull();
    expect(root.querySelector('.shm-gift-button')).toBeNull();

    const library = root.querySelector<HTMLAnchorElement>('.shm-games-library');
    expect(library?.getAttribute('href')).toBe(RSI_GAMES_LIBRARY_URL);
    expect(library?.textContent?.trim()).toBe('Games Library');
  });

  it('names a single game, and tells that a pledge without a ship takes no CCU', () => {
    // Like the "VIP High Admiral" reward: the game, but no ship to upgrade.
    const root = render({
      protectedGames: ['SQ42'],
      items: [{ title: 'Squadron 42 Digital Download', kind: 'Downloadable' }],
    });
    const lock = root.querySelector('.shm-badge.is-protected');
    expect(lock?.textContent?.trim()).toBe('SQ42');
    const tooltip = lock?.getAttribute('aria-description');
    expect(tooltip).toContain(
      "for Squadron 42. It can't be melted or gifted, and as it contains no ship, it can't be " +
        'upgraded with CCUs either.',
    );
  });

  it('names only the game of a pledge that protects Star Citizen alone', () => {
    const root = render({ protectedGames: ['SC'], items: [{ title: 'Aurora MR', kind: 'Ship' }] });
    const lock = root.querySelector('.shm-badge.is-protected');
    expect(lock?.textContent?.trim()).toBe('SC');
    const tooltip = lock?.getAttribute('aria-description');
    expect(tooltip).toContain('for Star Citizen.');
    expect(tooltip).not.toContain('Squadron 42');
  });

  it('names only the game of a pledge that protects Squadron 42 alone', () => {
    const root = render({
      protectedGames: ['SQ42'],
      items: [{ title: 'Aurora MR', kind: 'Ship' }],
    });
    const lock = root.querySelector('.shm-badge.is-protected');
    expect(lock?.textContent?.trim()).toBe('SQ42');
    const tooltip = lock?.getAttribute('aria-description');
    expect(tooltip).toContain('for Squadron 42.');
    expect(tooltip).not.toContain('Star Citizen');
  });

  it('links the Games Library for every pledge with the game, protected or not', () => {
    const library = (root: HTMLElement) => root.querySelector('.shm-games-library');
    // A game package that isn't the protected one: no lock, but the link.
    const gamePackage = render({ category: 'game_package' });
    expect(gamePackage.querySelector('.shm-badge.is-protected')).toBeNull();
    expect(library(gamePackage)?.getAttribute('href')).toBe(RSI_GAMES_LIBRARY_URL);
    app?.unmount();
    // A package that contains the game, e.g. a VIP reward.
    const vip = render({
      items: [{ title: 'Star Citizen Digital Download', kind: 'Downloadable' }],
    });
    expect(library(vip)).not.toBeNull();
  });

  it('shows neither lock nor Games Library for other pledges', () => {
    const root = render({});
    expect(root.querySelector('.shm-badge.is-protected')).toBeNull();
    expect(root.querySelector('.shm-games-library')).toBeNull();
    expect(badges(root)).toEqual([
      ['Gift', false],
      ['Melt', false],
    ]);
  });

  it('shows a discount, but none for exactly the original price', () => {
    expect(render({}, 10).querySelector('.shm-discount')?.textContent).toContain('$10');
    app?.unmount();
    expect(render({}, 0).querySelector('.shm-discount')).toBeNull();
  });

  it('marks a paint the Paint Discount Consultant would buy again', () => {
    paintRebuys.value = new Map([[7, { kind: 'rebuy', from: 0, to: 35, freed: 1.75 }]]);
    const paint = { id: 7, items: [{ title: 'Lynx - Moonrise Paint', kind: 'Skin' }] };

    const marked = render(paint);
    const badge = marked.querySelector('.shm-badge.is-rebuy');
    expect(badge?.tagName).toBe('BUTTON');
    expect(badge?.textContent?.trim()).toBe('Rebuy 0% → 35%');

    app?.unmount();
    expect(render({ ...paint, id: 8 }).querySelector('.shm-badge.is-rebuy')).toBeNull();
  });

  it('marks the old pledge of a paint bought again as left to melt (#139)', () => {
    paintRebuys.value = new Map([[9, { kind: 'melt', from: 0, to: 35, freed: 5 }]]);
    const old = { id: 9, items: [{ title: 'Lynx - Moonrise Paint', kind: 'Skin' }] };
    const badge = render(old).querySelector('.shm-badge.is-rebuy');
    expect(badge?.textContent?.trim()).toBe('Melt – bought again at 35%');
  });

  it('opens the base ship of a CCU in the Pledge Store tab when it leaves the store (#381)', () => {
    const ccu = { id: 3, title: 'Upgrade - Constellation Andromeda to Carrack', isGiftable: false };
    const entry = (to: number): RemovalCcus => ({
      removal: {
        ship: { id: 45, name: 'Constellation Mk IV Andromeda' },
        removedAt: { at: Date.parse('2027-01-27T00:00:00Z'), dayOnly: true },
        source: 'https://robertsspaceindustries.com/en/comm-link/transmission/21350',
      },
      from: [{ source: 'hangar', id: 3, title: ccu.title }],
      to: Array.from({ length: to }, (_, index) => ({
        source: 'buyback',
        id: 10 + index,
        title: '',
      })),
      level: to >= 1 ? 'warning' : 'critical',
    });

    const warned = render(ccu, undefined, [entry(1)]);
    const button = warned.querySelector<HTMLElement>('.shm-removal-button');
    expect(button?.textContent?.trim()).toBe('Show in Pledge Store');
    expect(button?.classList.contains('is-warning')).toBe(true);
    button!.click();
    expect(shipRemovalRequest.value).toEqual({ shipId: 45 });
    expect(location.hash).toBe('#hangar-manager-store');
    shipRemovalRequest.value = undefined;

    app?.unmount();
    const critical = render(ccu, undefined, [entry(0)]).querySelector('.shm-removal-button');
    expect(critical?.classList.contains('is-danger')).toBe(true);

    app?.unmount();
    expect(
      render({ id: 4 }, undefined, [entry(1)]).querySelector('.shm-removal-button'),
    ).toBeNull();
  });

  describe('the label "Always available" of a CCU (#112)', () => {
    const ccu: Partial<Pledge> = {
      name: 'Upgrade - Aurora MR to Avenger Titan',
      title: 'Upgrade - Aurora MR to Avenger Titan',
      isUpgraded: false,
      items: [{ title: 'Aurora MR to Avenger Titan', kind: 'Upgrade' }],
    };
    const coverage = (covered: boolean): CcuCoverage => ({
      id: 1,
      baseShip: { id: 7, name: 'Aurora MR' },
      hangar: { ships: [], ccus: [] },
      buyback: { ships: [], ccus: [] },
      covered,
    });
    const list = (changedAt = '2026-11-18T12:00:00Z'): AlwaysAvailableList => ({
      source: { id: 'wiki', name: 'Star Citizen Wiki', url: 'https://w', facts: [] },
      changedAt,
      has: (id) => id === 7,
    });
    const label = (root: HTMLElement) => root.querySelector('.shm-badge.is-always-available');

    it('marks a CCU whose base ship is on the list, covered or not, naming source and date', () => {
      for (const covered of [false, true]) {
        const root = render(ccu, undefined, [], { coverage: coverage(covered), list: list() });
        expect(label(root)?.textContent?.trim()).toBe('Base always available');
        expect(label(root)?.getAttribute('aria-description')).toBe(
          'The base ship Aurora MR is always available in the Pledge Store, so you can get onto ' +
            'it later to apply this CCU. Source: Star Citizen Wiki, as of Nov 18, 2026.',
        );
        app!.unmount();
        app = undefined;
      }
    });

    it('names only the source without a date of the list', () => {
      const root = render(ccu, undefined, [], { coverage: coverage(false), list: list('') });
      expect(label(root)?.getAttribute('aria-description')).toMatch(/Source: Star Citizen Wiki\.$/);
    });

    it('shows none for a base ship not on the list, nor while the setting is off', () => {
      const other = { ...coverage(false), baseShip: { id: 8, name: 'Idris-P' } };
      expect(label(render(ccu, undefined, [], { coverage: other, list: list() }))).toBeNull();
      app!.unmount();
      expect(label(render(ccu, undefined, [], { coverage: coverage(false) }))).toBeNull();
      app!.unmount();
      expect(label(render(ccu))).toBeNull();
    });
  });

  describe('the note on a CCU without its base ship (#114)', () => {
    const ccu: Partial<Pledge> = {
      name: 'Upgrade - Cutlass Red to Mantis',
      title: 'Upgrade - Cutlass Red to Mantis',
      isUpgraded: false,
      upgrade: {
        matchItems: [{ name: 'Cutlass Red' }],
        targetItems: [{ name: 'Mantis' }],
        type: 'R',
      } as Pledge['upgrade'],
      items: [{ title: 'Cutlass Red to Mantis', kind: 'Upgrade' }],
    };
    const coverage = (covered = false): CcuCoverage => ({
      id: 1,
      baseShip: { id: 9, name: 'Cutlass Red' },
      hangar: { ships: [], ccus: [] },
      buyback: covered
        ? { ships: [], ccus: [{ source: 'buyback', kind: 'ccu', id: 5, title: 'To Cutlass Red' }] }
        : { ships: [], ccus: [] },
      covered,
    });
    const list = (ids: number[]): AlwaysAvailableList => ({
      source: { id: 'wiki', name: 'Star Citizen Wiki', url: 'https://w', facts: [] },
      changedAt: '',
      has: (id) => ids.includes(id),
    });
    const ships: Ship[] = [
      { id: 9, name: 'Cutlass Red', msrp: 135, link: '/pledge/ships/drake-cutlass/cutlass-red' },
    ];
    const badge = (root: HTMLElement) => root.querySelector('.shm-badge.is-base-missing');
    const note = (root: HTMLElement) => root.querySelector('.shm-base-missing-note');

    it('tells that the base ship is probably not always available, with its Pledge Store page', () => {
      const root = render(ccu, undefined, [], { coverage: coverage(), list: list([]), ships });
      expect(badge(root)?.textContent?.trim()).toBe('Base ship missing');
      const text =
        'Neither Cutlass Red nor a CCU to it is in your hangar or buy back, and it’s probably ' +
        'not always available in the Pledge Store.';
      expect(badge(root)?.getAttribute('aria-description')).toBe(text);
      expect(note(root)?.textContent).toContain(text);
      const link = note(root)?.querySelector('a');
      expect(link?.textContent?.trim()).toBe('Cutlass Red in the Pledge Store');
      expect(link?.href).toBe(
        'https://robertsspaceindustries.com/pledge/ships/drake-cutlass/cutlass-red',
      );
    });

    it('leaves out the availability while always available ships are not considered', () => {
      const root = render(ccu, undefined, [], { coverage: coverage() });
      expect(badge(root)?.getAttribute('aria-description')).toBe(
        'Neither Cutlass Red nor a CCU to it is in your hangar or buy back.',
      );
      expect(note(root)?.querySelector('a')).toBeNull();
    });

    it('shows none for a covered CCU or an always available base ship', () => {
      expect(
        badge(render(ccu, undefined, [], { coverage: coverage(true), list: list([]) })),
      ).toBeNull();
      app!.unmount();
      const root = render(ccu, undefined, [], { coverage: coverage(), list: list([9]) });
      expect(badge(root)).toBeNull();
      expect(note(root)).toBeNull();
      expect(root.querySelector('.shm-badge.is-always-available')).not.toBeNull();
    });
  });

  describe('Melt and Rebuy (#530)', () => {
    const paint = {
      id: 5,
      title: 'Paint - Cutlass Black Skull Paint',
      value: '$10.00 USD',
      valueUsd: 10,
      isGiftable: false,
    };
    const on = { shown: true, hideValues: false };
    const rebuyable = { rebuyable: true, reasons: [], freedCredit: 10, rebuyPrice: 10 };
    const discounted = {
      rebuyable: false,
      reasons: [
        { code: 'giftable' as const },
        { code: 'discount' as const, amount: 2, percent: 16.7, price: 12 },
      ],
      freedCredit: 10,
      rebuyPrice: 12,
    };
    const label = (root: HTMLElement) => root.querySelector('.shm-badge.is-rebuyable');
    const reasons = (root: HTMLElement) =>
      [...root.querySelectorAll('.shm-rebuy-reasons li')].map((item) => item.textContent?.trim());

    it('labels a rebuyable pledge, with the freed store credit and the rebuy price', () => {
      const root = render(paint, undefined, [], undefined, { entry: rebuyable, display: on });
      expect(label(root)?.textContent?.trim()).toBe('Rebuyable');
      expect(label(root)?.getAttribute('aria-description')).toBe(
        'Melting it frees $10 in store credit. Rebuying it in the Pledge Store costs $10 in store credit now – the same item with the same insurance.',
      );
      expect(root.querySelector('.shm-rebuy-reasons')).toBeNull();
    });

    it('tells why a meltable pledge can’t be rebought without loss, without amounts if hidden', () => {
      const root = render(paint, undefined, [], undefined, { entry: discounted, display: on });
      expect(label(root)).toBeNull();
      expect(root.querySelector('.shm-rebuy-reasons h4')?.textContent).toBe(
        'Can’t be rebought without loss',
      );
      expect(reasons(root)).toEqual(['Giftable', 'Discount of $2']);
      app!.unmount();
      const hidden = render(paint, undefined, [], undefined, {
        entry: discounted,
        display: { shown: true, hideValues: true },
      });
      expect(reasons(hidden)).toEqual(['Giftable', 'Discount']);
    });

    it('shows no reasons for a pledge that can’t be melted', () => {
      const root = render({ ...paint, isExchangeable: false }, undefined, [], undefined, {
        entry: { ...discounted, reasons: [{ code: 'notMeltable' }] },
        display: on,
      });
      expect(root.querySelector('.shm-rebuy-reasons')).toBeNull();
    });

    it('shows neither label nor reasons with its setting off', () => {
      const off = { shown: false, hideValues: false };
      expect(
        label(render(paint, undefined, [], undefined, { entry: rebuyable, display: off })),
      ).toBeNull();
      app!.unmount();
      const root = render(paint, undefined, [], undefined, { entry: discounted, display: off });
      expect(root.querySelector('.shm-rebuy-reasons')).toBeNull();
    });
  });
});

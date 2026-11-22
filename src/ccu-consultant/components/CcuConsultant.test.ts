// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, shallowRef, type App } from 'vue';
import { DEFAULT_SETTINGS, type CcuConsultantView, type Settings } from '@/settings/settings';
import { REMOVAL_CCUS, removalCcusState } from '@/ship-removals/use-removal-ccus';
import type { ShipRemoval } from '@/ship-removals/ship-removals';
import { ALWAYS_AVAILABLE, withoutLeaving, type AlwaysAvailableList } from '../always-available';
import { CCU_COVERAGE, COVERAGE_SOURCES, type CcuCoverage } from '../coverage';
import CcuConsultant from './CcuConsultant.vue';
import { listShortcuts } from '@/hangar/list-shortcut';

let app: App | undefined;
afterEach(() => app?.unmount());

const none = { ships: [], ccus: [] };
const coverage = (id: number, base: number, name: string, buyback = false): CcuCoverage => ({
  id,
  baseShip: { id: base, name },
  hangar: none,
  buyback: buyback
    ? { ships: [], ccus: [{ source: 'buyback', kind: 'ccu', id: 500 + id, title: `To ${name}` }] }
    : none,
  covered: buyback,
});
const always: AlwaysAvailableList = {
  source: { id: 'wiki', name: 'Star Citizen Wiki', url: 'https://w', facts: [] },
  changedAt: '2026-11-18T12:00:00Z',
  has: (id) => id === 1,
};

function render(
  coverages: CcuCoverage[],
  consider = true,
  obtainable: ReadonlyMap<number, ShipRemoval> = new Map(),
  view: CcuConsultantView = 'deep',
) {
  const updates: Partial<Settings>[] = [];
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ccuConsultant: { ...DEFAULT_SETTINGS.ccuConsultant, considerAlwaysAvailable: consider, view },
  };
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp({
    render: () => h(CcuConsultant, { settings, onUpdate: (patch) => updates.push(patch) }),
  });
  app.provide(CCU_COVERAGE, shallowRef(new Map(coverages.map((c) => [c.id, c]))));
  app.provide(
    ALWAYS_AVAILABLE,
    shallowRef(withoutLeaving(consider ? always : undefined, obtainable)),
  );
  app.provide(REMOVAL_CCUS, shallowRef({ ...removalCcusState([]), obtainable }));
  app.provide(
    COVERAGE_SOURCES,
    shallowRef({
      hangar: new Map(),
      buyback: new Map(),
      ships: [
        {
          id: 2,
          name: 'Cutlass Red',
          msrp: 135,
          link: '/pledge/ships/cutlass-red',
          image: 'https://img/cutlass.jpg',
        },
      ],
    }),
  );
  app.mount(root);
  return { root, updates };
}

const tabs = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('.shm-tab')].map((tab) =>
    tab.textContent!.replace(/\s+/g, ' ').trim(),
  );
const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();
/** The rows of the deep view (#563): the ship, its sale, its ways and its secure panel. */
const rows = (root: HTMLElement) =>
  [...root.querySelectorAll('.shm-ccu-deep-row')].map((row) => ({
    name: text(row.querySelector('.shm-ccu-deep-name')),
    sale: text(row.querySelector('.shm-ccu-card-sale')),
    count: text(row.querySelector('.shm-ccu-deep-count')),
    secure: text(row.querySelector('.shm-ccu-deep-secure-title')),
  }));

describe('CcuConsultant (#113)', () => {
  const ccus = [
    coverage(10, 2, 'Cutlass Red'),
    coverage(11, 2, 'Cutlass Red'),
    coverage(12, 3, 'Razor', true),
    coverage(13, 1, 'Arrow'),
  ];

  it('shows the groups with their counts, those short of ways first', async () => {
    const { root } = render(ccus);
    // Its name is the sub tab or the heading of the tab "Consultants" (#453).
    expect(root.querySelector('section')?.getAttribute('aria-label')).toBe('CCU Consultant');
    // The question in the box, the switch next to it.
    const box = root.querySelector('.shm-ccu-consultant-box')!;
    expect(box.querySelector('h4')?.textContent).toBe('Can you apply every CCU?');
    expect(box.querySelector('.shm-ccu-consultant-head input[role="switch"]')).not.toBeNull();
    expect(root.querySelector('.shm-ccu-consultant-intro')?.textContent).toContain('all 4 CCUs');
    // The deep view's first group: the CCUs short of a way by the chain rule (#563).
    expect(tabs(root)).toEqual([
      'Too few ways 2',
      'Buy back only 1',
      'Always available 1',
      'Discount at risk 0',
    ]);
    expect(text(root.querySelector('.shm-ccu-consultant-group-title'))).toBe(
      'Too few ways to the base ship 2',
    );
    expect(rows(root)).toEqual([
      {
        name: 'Cutlass Red',
        sale: 'Not on sale now',
        count: '0 of 2 ways · 2 too few',
        secure: 'Not on sale now – watch for the next sale',
      },
    ]);
    expect(root.querySelector<HTMLAnchorElement>('.shm-ccu-deep-actions a')?.href).toBe(
      'https://robertsspaceindustries.com/pledge/ships/cutlass-red',
    );

    root.querySelectorAll<HTMLElement>('.shm-tab')[1]!.click();
    await Promise.resolve();
    expect(rows(root)[0]?.count).toBe('1 of 1 way');
    expect(text(root.querySelector('.shm-ccu-deep-own.is-buyback'))).toBe('1 in your buy back');

    root.querySelectorAll<HTMLElement>('.shm-tab')[2]!.click();
    await Promise.resolve();
    expect(root.querySelector('.shm-ccu-consultant-hint')?.textContent).toBe(
      'Nothing of these base ships is in your hangar or buy back, but RSI always sells them. ' +
        'Source: Star Citizen Wiki, list of Nov 18, 2026.',
    );
    expect(rows(root)[0]?.secure).toBe('Always available – no need to secure it now');
  });

  it('lists every CCU without coverage while always available ships are not considered', () => {
    const { root } = render(ccus, false);
    expect(tabs(root)).toEqual(['Too few ways 3', 'Buy back only 1', 'Discount at risk 0']);
    expect(rows(root).map((row) => row.name)).toEqual(['Cutlass Red', 'Arrow']);
  });

  it('says so when every CCU can be applied', () => {
    const { root } = render([coverage(12, 3, 'Razor', true), coverage(13, 1, 'Arrow')]);
    // The first group with CCUs is shown; the one without base ship is empty.
    expect(root.querySelector('.shm-tab.is-active')?.textContent).toContain('Buy back only');
    root.querySelector<HTMLElement>('.shm-tab')!.click();
    return Promise.resolve().then(() =>
      expect(root.querySelector('.shm-ccu-consultant-empty')?.textContent).toContain(
        'Every CCU can be applied',
      ),
    );
  });

  it('switches "Consider always available ships" like the settings', () => {
    const { root, updates } = render(ccus);
    const input = root.querySelector<HTMLInputElement>('input[role="switch"]')!;
    expect(input.checked).toBe(true);
    input.checked = false;
    input.dispatchEvent(new Event('change'));
    expect(updates).toEqual([
      {
        ccuConsultant: {
          ...DEFAULT_SETTINGS.ccuConsultant,
          considerAlwaysAvailable: false,
          view: 'deep',
        },
      },
    ]);
  });

  it('tells when the hangar has no CCUs', () => {
    const { root } = render([]);
    expect(root.querySelector('.shm-ccu-consultant-intro')?.textContent?.trim()).toBe(
      'There are no CCUs in your hangar.',
    );
    expect(root.querySelector('.shm-ccu-deep-row')).toBeNull();
  });
});

describe('the deep view of the CCU Consultant (#563)', () => {
  afterEach(() => {
    listShortcuts.value = { hangar: null, buyback: null };
    location.hash = '';
  });
  const removal = (id: number, name: string): ShipRemoval => ({
    ship: { id, name },
    removedAt: { at: Date.parse('2027-01-27T00:00:00Z'), dayOnly: true },
    source: 'https://robertsspaceindustries.com/en/comm-link/transmission/21350',
  });
  const viaBuyback = (id: number, base: number, name: string) => ({
    ...coverage(id, base, name),
    buyback: {
      ships: [],
      ccus: [{ source: 'buyback' as const, kind: 'ccu' as const, id: 700, title: `To ${name}` }],
    },
    covered: true,
  });

  it('counts the ways to a base ship, each for one CCU, and opens the buy back’s', () => {
    const { root } = render([
      viaBuyback(20, 2, 'Cutlass Red'),
      viaBuyback(21, 2, 'Cutlass Red'),
      viaBuyback(22, 2, 'Cutlass Red'),
    ]);
    expect(tabs(root)[0]).toBe('Too few ways 2');
    expect(rows(root)[0]?.count).toBe('1 of 3 ways · 2 too few');
    // One segment per CCU: one via buy back, two too few.
    const segments = [...root.querySelectorAll('.shm-ccu-deep-bar span')].map(
      (segment) => segment.className,
    );
    expect(segments).toEqual(['is-buyback', 'is-short', 'is-short']);
    expect(root.querySelector('.shm-ccu-deep-bar')?.getAttribute('aria-label')).toBe(
      '1 of 3 CCUs from Cutlass Red have a way to it, 2 too few.',
    );
    root.querySelector<HTMLButtonElement>('.shm-ccu-deep-own.is-buyback')!.click();
    expect(listShortcuts.value.buyback?.id).toBe('ccuConsultant:to:id:2');
    expect(listShortcuts.value.buyback?.matches({ id: 700 } as never)).toBe(true);
    // The legend names only what the bars show.
    expect([...root.querySelectorAll('.shm-ccu-deep-legend li')].map((item) => text(item))).toEqual(
      ['Buy back', 'Too few'],
    );
  });

  it('finds a base ship the simple view counts as covered: a chain without a start', () => {
    // CCU 30 from the Cutlass Red, whose only way is CCU 31 from the Razor – with no way to it.
    const chained: CcuCoverage = {
      ...coverage(30, 2, 'Cutlass Red'),
      hangar: {
        ships: [],
        ccus: [{ source: 'hangar', kind: 'ccu', id: 31, title: 'Upgrade - Razor to Cutlass Red' }],
      },
      covered: true,
    };
    const { root } = render([chained, coverage(31, 3, 'Razor')]);
    expect(tabs(root)[0]).toBe('Too few ways 2');
    const cutlass = root.querySelectorAll('.shm-ccu-deep-row')[0]!;
    expect(cutlass.classList.contains('is-found')).toBe(true);
    expect(text(cutlass.querySelector('.shm-ccu-deep-found'))).toBe('Found by the deep view');
    const blocked = cutlass.querySelector('.shm-ccu-deep-routes li.is-blocked')!;
    expect([...blocked.children].map((part) => text(part)).join(' ')).toBe(
      'Razor → ×1 don’t count: Razor itself has too few ways',
    );
    expect(rows(root).map((row) => row.name)).toEqual(['Cutlass Red', 'Razor']);

    // The simple view counts it covered: only the Razor lacks a base ship.
    app?.unmount();
    const simple = render([chained, coverage(31, 3, 'Razor')], true, new Map(), 'simple');
    expect(tabs(simple.root)[0]).toBe('No base ship 1');
  });

  it('shows a ship leaving the Pledge Store with its countdown and the way to it there', () => {
    const { root } = render(
      [coverage(10, 2, 'Cutlass Red'), coverage(13, 1, 'Arrow'), coverage(14, 1, 'Arrow')],
      true,
      new Map([[1, removal(1, 'Arrow')]]),
    );
    // Always available until now, but leaving: no longer "Base always available".
    expect(tabs(root)).toEqual([
      'Too few ways 3',
      'Buy back only 0',
      'Always available 0',
      'Discount at risk 0',
    ]);
    const arrow = [...root.querySelectorAll('.shm-ccu-deep-row')].find(
      (row) => text(row.querySelector('.shm-ccu-deep-name')) === 'Arrow',
    )!;
    expect(text(arrow.querySelector('.shm-badge.is-price-increase'))).toMatch(/^Removal: /);
    expect(text(arrow.querySelector('.shm-ccu-deep-actions'))).toBe('Show in Pledge Store');
    expect(text(arrow.querySelector('.shm-ccu-deep-count'))).toBe('0 of 2 ways · 2 too few');
  });

  it('opens the CCUs of a row and of the whole group in My Hangar', () => {
    const { root } = render([
      coverage(10, 2, 'Cutlass Red'),
      coverage(11, 2, 'Cutlass Red'),
      coverage(13, 1, 'Arrow'),
    ]);
    root.querySelector<HTMLButtonElement>('.shm-ccu-deep-name')!.click();
    expect(listShortcuts.value.hangar?.title()).toBe('CCUs from Cutlass Red');
    const show = root.querySelector<HTMLButtonElement>('.shm-ccu-consultant-show')!;
    // Every CCU from the base ships short of ways (Arrow is always available).
    expect(show.textContent?.trim()).toBe('Show 2 CCUs in My Hangar');
    show.click();
    expect(listShortcuts.value.hangar?.id).toBe('ccuConsultant:tooFew');
    expect(listShortcuts.value.hangar?.title()).toBe('CCU Consultant: Too few ways');
  });
});

describe('the tab "Discount at risk" (#455)', () => {
  it('follows the tabs of the coverage and says when no discount is at risk', async () => {
    const { root } = render([coverage(10, 2, 'Cutlass Red')]);
    expect(tabs(root).at(-1)).toBe('Discount at risk 0');
    // Not part of the coverage bar.
    expect(root.querySelectorAll('.shm-ccu-consultant-legend li')).toHaveLength(4);
    root.querySelectorAll<HTMLElement>('.shm-tab').item(3).click();
    await Promise.resolve();
    expect(root.querySelector('#shm-ccu-consultant-panel-atRisk')).not.toBeNull();
    expect(
      root.querySelector('.shm-ccu-consultant-empty')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe(
      'No discount at risk No base ship of your CCUs gets more expensive within the next 14 days.',
    );
  });
});

describe('the views of the CCU Consultant (#563)', () => {
  afterEach(() => {
    listShortcuts.value = { hangar: null, buyback: null };
    location.hash = '';
  });
  const ccus = [
    coverage(10, 2, 'Cutlass Red'),
    coverage(11, 2, 'Cutlass Red'),
    coverage(12, 3, 'Razor', true),
    coverage(13, 1, 'Arrow'),
  ];
  /** The parts of the line of ways, each once, without the thumbnails' numbers. */
  const waysText = (ways: Element | null) => {
    if (!ways) return undefined;
    const parts = [...ways.children].filter((part) => !part.matches('.shm-ccu-card-thumbs'));
    return parts.length
      ? parts.map((part) => part.textContent!.trim()).join(' ')
      : ways.textContent!.trim();
  };
  const cards = (root: HTMLElement) =>
    [...root.querySelectorAll('.shm-ccu-card')].map((card) => ({
      name: card.querySelector('.shm-ccu-card-name')?.textContent?.trim(),
      count: card.querySelector('.shm-ccu-card-count')?.textContent?.replace(/\s+/g, ' ').trim(),
      price: card.querySelector('.shm-ccu-card-price')?.textContent?.trim(),
      sale: card.querySelector('.shm-ccu-card-sale')?.textContent?.trim(),
      ways: waysText(card.querySelector('.shm-ccu-card-ways')),
      action: card.querySelector('.shm-ccu-card-action')?.textContent?.trim(),
    }));

  it('shows the base ships as cards in the simple view, with the shared header', () => {
    const { root } = render(ccus, true, new Map(), 'simple');
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('.shm-ccu-consultant-group-title')?.textContent).toMatch(
      /^\s*Without base ship\s+2\s*$/,
    );
    expect(cards(root)).toEqual([
      {
        name: 'Cutlass Red',
        count: '2 CCUs from it',
        price: '$135',
        sale: 'Not on sale now',
        ways: 'Nothing in hangar or buy back',
        action: 'Pledge Store',
      },
    ]);
    expect(root.querySelector<HTMLImageElement>('.shm-ccu-card-image img')?.src).toBe(
      'https://img/cutlass.jpg',
    );
  });

  it('shows what the buy back has of a base ship and opens it in Buy Back', async () => {
    const { root } = render(ccus, true, new Map(), 'simple');
    root.querySelectorAll<HTMLElement>('.shm-tab')[1]!.click();
    await Promise.resolve();
    expect(cards(root)).toEqual([
      {
        name: 'Razor',
        count: '1 CCU from it',
        price: undefined,
        sale: 'Not on sale now',
        ways: '1 way to it',
        action: 'Buy Back',
      },
    ]);
    root.querySelector<HTMLButtonElement>('.shm-ccu-card-action button')!.click();
    expect(listShortcuts.value.buyback?.id).toBe('ccuConsultant:to:id:3');
    expect(listShortcuts.value.buyback?.matches({ id: 512 } as never)).toBe(true);
    expect(listShortcuts.value.buyback?.title()).toBe('Ships and CCUs to Razor');
  });

  it('opens the CCUs of a card and of the whole group in My Hangar', () => {
    const { root } = render(ccus, true, new Map(), 'simple');
    root.querySelector<HTMLButtonElement>('.shm-ccu-card-main')!.click();
    expect(listShortcuts.value.hangar?.title()).toBe('CCUs from Cutlass Red');
    expect([10, 11, 12].map((id) => listShortcuts.value.hangar?.matches({ id } as never))).toEqual([
      true,
      true,
      false,
    ]);

    const show = root.querySelector<HTMLButtonElement>('.shm-ccu-consultant-show')!;
    expect(show.textContent?.trim()).toBe('Show 2 CCUs in My Hangar');
    show.click();
    expect(listShortcuts.value.hangar?.id).toBe('ccuConsultant:missing');
    expect(listShortcuts.value.hangar?.title()).toBe('CCU Consultant: Without base ship');
  });

  it('has the toggle in both views and remembers the choice in the settings', () => {
    for (const view of ['simple', 'deep'] as const) {
      const { root, updates } = render(ccus, true, new Map(), view);
      const options = [...root.querySelectorAll<HTMLInputElement>('.shm-segment input')];
      expect(options.map((option) => option.checked)).toEqual([view === 'simple', view === 'deep']);
      const other = options[view === 'simple' ? 1 : 0]!;
      other.checked = true;
      other.dispatchEvent(new Event('change'));
      expect(updates.at(-1)?.ccuConsultant?.view).toBe(view === 'simple' ? 'deep' : 'simple');
      app?.unmount();
      app = undefined;
    }
  });

  it('lists the base ships with too few ways below, with the ways and the shortage', () => {
    const viaBuyback = (id: number) => ({
      ...coverage(id, 2, 'Cutlass Red'),
      buyback: {
        ships: [],
        ccus: [
          {
            source: 'buyback' as const,
            kind: 'ccu' as const,
            id: 700,
            title: 'Upgrade - Cutlass Red to Hull B',
          },
        ],
      },
      covered: true,
    });
    const { root } = render(
      [viaBuyback(20), viaBuyback(21), viaBuyback(22)],
      true,
      new Map(),
      'simple',
    );
    expect(root.querySelector('.shm-ccu-consultant-soon-title')?.textContent).toMatch(
      /Too few ways to the base ship\s+2/,
    );
    // The thumbnail of a CCU to it shows the ship it starts from.
    expect(cards(root).at(-1)?.ways).toBe('1 way to it 2 too few');
    expect(root.querySelector<HTMLImageElement>('.shm-ccu-card-thumbs img')?.src).toBe(
      'https://img/cutlass.jpg',
    );
  });
});

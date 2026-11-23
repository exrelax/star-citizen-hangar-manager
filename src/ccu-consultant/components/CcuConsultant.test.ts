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

/** A cell's text without the button that opens the base ship's CCUs (#456). */
const cellText = (cell: Element) => {
  const copy = cell.cloneNode(true) as Element;
  copy.querySelector('.shm-ccu-consultant-ccus-toggle')?.remove();
  return copy.textContent!.replace(/\s+/g, ' ').trim();
};
const tabs = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('.shm-tab')].map((tab) =>
    tab.textContent!.replace(/\s+/g, ' ').trim(),
  );
const cells = (root: HTMLElement) =>
  [...root.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map(cellText),
  );

describe('CcuConsultant (#113)', () => {
  const ccus = [
    coverage(10, 2, 'Cutlass Red'),
    coverage(11, 2, 'Cutlass Red'),
    coverage(12, 3, 'Razor', true),
    coverage(13, 1, 'Arrow'),
  ];

  it('shows the groups with their counts, those without base ship first', async () => {
    const { root } = render(ccus);
    // Its name is the sub tab or the heading of the tab "Consultants" (#453).
    expect(root.querySelector('section')?.getAttribute('aria-label')).toBe('CCU Consultant');
    // The question in the box, the switch next to it.
    const box = root.querySelector('.shm-ccu-consultant-box')!;
    expect(box.querySelector('h4')?.textContent).toBe('Can you apply every CCU?');
    expect(box.querySelector('.shm-ccu-consultant-head input[role="switch"]')).not.toBeNull();
    expect(root.querySelector('.shm-ccu-consultant-intro')?.textContent).toContain('all 4 CCUs');
    expect(tabs(root)).toEqual([
      'No base ship 2',
      'Buy back only 1',
      'Always available 1',
      'Discount at risk 0',
    ]);
    expect(cells(root)).toEqual([
      [
        'Cutlass RedNot always available · Standard price $135',
        '2',
        'Nothing foundNeither it nor a CCU to it in your hangar or buy backPledge Store',
      ],
    ]);
    expect(root.querySelector<HTMLAnchorElement>('.shm-ccu-consultant-store')?.href).toBe(
      'https://robertsspaceindustries.com/pledge/ships/cutlass-red',
    );

    root.querySelectorAll<HTMLElement>('.shm-tab')[1]!.click();
    await Promise.resolve();
    expect(cells(root)[0]?.[2]).toBe('In your buy backTo Razor#512');
    const link = root.querySelector<HTMLAnchorElement>('.shm-ccu-consultant-matches a');
    expect(link?.href).toContain('search=512#hangar-manager-bb');

    root.querySelectorAll<HTMLElement>('.shm-tab')[2]!.click();
    await Promise.resolve();
    expect(root.querySelector('.shm-ccu-consultant-hint')?.textContent).toBe(
      'Nothing of these base ships is in your hangar or buy back, but RSI always sells them. ' +
        'Source: Star Citizen Wiki, list of Nov 18, 2026.',
    );
  });

  it('lists every CCU without coverage while always available ships are not considered', () => {
    const { root } = render(ccus, false);
    expect(tabs(root)).toEqual(['No base ship 3', 'Buy back only 1', 'Discount at risk 0']);
    expect(cells(root).map((row) => row[0])).toEqual([
      'Cutlass RedNot always available · Standard price $135',
      'ArrowNot always available',
    ]);
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
    expect(root.querySelector('table')).toBeNull();
  });

  it('shows the first three pledges of the buy back, the others on request', async () => {
    const many: CcuCoverage = {
      ...coverage(20, 3, 'Razor', true),
      buyback: {
        ships: [],
        ccus: [1, 2, 3, 4, 5].map((n) => ({
          source: 'buyback' as const,
          kind: 'ccu' as const,
          id: 600 + n,
          title: `To Razor ${n}`,
        })),
      },
    };
    const { root } = render([many]);
    const links = () => root.querySelectorAll('.shm-ccu-consultant-matches a').length;
    expect(links()).toBe(3);
    const more = root.querySelector<HTMLButtonElement>(
      '.shm-ccu-consultant-more:not(.shm-ccu-consultant-ccus-toggle)',
    )!;
    expect(more.textContent?.trim()).toBe('+ 2 more');
    more.click();
    await Promise.resolve();
    expect(links()).toBe(5);
    expect(more.textContent?.trim()).toBe('Show fewer');
  });
});

describe('CCUs soon without base ship (#454)', () => {
  const removal = (id: number, name: string): ShipRemoval => ({
    ship: { id, name },
    removedAt: { at: Date.parse('2027-01-27T00:00:00Z'), dayOnly: true },
    source: 'https://robertsspaceindustries.com/en/comm-link/transmission/21350',
  });

  it('lists them below the CCUs without base ship, with the date and the way to the ship', () => {
    const { root } = render(
      [coverage(10, 2, 'Cutlass Red'), coverage(13, 1, 'Arrow'), coverage(14, 1, 'Arrow')],
      true,
      new Map([[1, removal(1, 'Arrow')]]),
    );
    // Always available until now, but leaving: no longer "Base always available".
    expect(tabs(root)).toEqual([
      'No base ship 3',
      'Buy back only 0',
      'Always available 0',
      'Discount at risk 0',
    ]);
    const title = root.querySelector('.shm-ccu-consultant-soon-title');
    expect(title?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Soon without base ship 2');
    const soon = root.querySelectorAll('.shm-ccu-consultant-table')[1]!;
    const row = [...soon.querySelectorAll('tbody td')].map((cell) => cellText(cell));
    expect(row[0]).toBe('ArrowIn the Pledge Store until Jan 27, 2027');
    expect(row[1]).toBe('2');
    // No ship or CCU to it: both CCUs from it are short.
    expect(row[2]).toBe('0 2 too few');
    expect(row[3]).toMatch(/^Removal: .+Show in Pledge Store$/);
    // The ships leaving the Pledge Store are left out of the table above.
    expect(cells(root)[0]?.[0]).toContain('Cutlass Red');
    expect(cells(root)).toHaveLength(2);
  });

  it('counts the ways to a leaving ship covered too few times', () => {
    const viaBuyback = (id: number) => ({
      ...coverage(id, 1, 'Arrow'),
      buyback: {
        ships: [],
        ccus: [{ source: 'buyback' as const, kind: 'ccu' as const, id: 600, title: 'To Arrow' }],
      },
      covered: true,
    });
    const { root } = render(
      [viaBuyback(13), viaBuyback(14), viaBuyback(15)],
      true,
      new Map([[1, removal(1, 'Arrow')]]),
    );
    // Covered today by the buy back, but two of three will be short: the tab counts them.
    expect(tabs(root)).toEqual([
      'No base ship 2',
      'Buy back only 3',
      'Always available 0',
      'Discount at risk 0',
    ]);
    const title = root.querySelector('.shm-ccu-consultant-soon-title');
    expect(title?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Soon without base ship 2');
    const soon = root.querySelectorAll('.shm-ccu-consultant-table');
    const row = [...soon[soon.length - 1]!.querySelectorAll('tbody td')].map((cell) =>
      cellText(cell),
    );
    expect(row[1]).toBe('3');
    const ways = soon[soon.length - 1]!.querySelector('.shm-ccu-consultant-ways');
    expect(ways?.textContent).toBe('1');
    expect(ways?.nextElementSibling?.textContent?.trim()).toBe(
      '0 in your hangar · 1 in your buy back',
    );
    expect(row[2]).toMatch(/2 too few$/);
  });

  it('has no such section without leaving ships', () => {
    const { root } = render([coverage(10, 2, 'Cutlass Red')]);
    expect(root.querySelector('.shm-ccu-consultant-soon-title')).toBeNull();
  });
});

describe('base ships with too few ways (#454)', () => {
  it('lists them in "Without base ship" with the ways and the shortage', () => {
    const viaBuyback = (id: number) => ({
      ...coverage(id, 2, 'Cutlass Red'),
      buyback: {
        ships: [],
        ccus: [
          { source: 'buyback' as const, kind: 'ccu' as const, id: 700, title: 'To Cutlass Red' },
        ],
      },
      covered: true,
    });
    const { root } = render([viaBuyback(20), viaBuyback(21), viaBuyback(22)]);
    expect(tabs(root)[0]).toBe('No base ship 2');
    const title = root.querySelector('.shm-ccu-consultant-soon-title');
    expect(title?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Too few ways to the base ship 2');
    const tables = root.querySelectorAll('.shm-ccu-consultant-table');
    const row = [...tables[tables.length - 1]!.querySelectorAll('tbody td')].map((cell) =>
      cellText(cell),
    );
    expect(row[0]).toBe('Cutlass RedNot always available · Standard price $135');
    expect(row[1]).toBe('3');
    expect(row[2]).toMatch(/^1.*2 too few$/);
    // Not on sale now (no SKU known), with its page in the Pledge Store.
    expect(row[3]).toBe('Not on sale nowPledge Store');
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

describe('the grouped view of the CCU Consultant (#456)', () => {
  it('has its toggle above the tables, switched like the settings', () => {
    const { root, updates } = render([coverage(10, 2, 'Cutlass Red')]);
    const toggle = root.querySelector<HTMLButtonElement>(
      '.shm-ccu-consultant-view-bar .shm-ccu-consultant-group-toggle',
    )!;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    expect(updates.at(-1)?.grouped?.consultant).toBe(false);
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

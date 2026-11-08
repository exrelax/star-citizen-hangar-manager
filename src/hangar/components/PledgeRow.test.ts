// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, type App } from 'vue';
import { RSI_GAMES_LIBRARY_URL } from '@/config';
import type { Pledge } from '../pledge';
import { toPledgeView } from '../pledge-view';
import { paintRebuys } from '@/store/paint-consultant/use-paint-consultant';
import PledgeRow from './PledgeRow.vue';

let app: App | undefined;
afterEach(() => {
  app?.unmount();
  paintRebuys.value = new Map();
});

function render(overrides: Partial<Pledge>, discountAmount?: number) {
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
    paintRebuys.value = new Map([[7, { from: 0, to: 35, freed: 1.75 }]]);
    const paint = { id: 7, items: [{ title: 'Lynx - Moonrise Paint', kind: 'Skin' }] };

    const marked = render(paint);
    const badge = marked.querySelector('.shm-badge.is-rebuy');
    expect(badge?.tagName).toBe('BUTTON');
    expect(badge?.textContent?.trim()).toBe('Rebuy 0% → 35%');

    app?.unmount();
    expect(render({ ...paint, id: 8 }).querySelector('.shm-badge.is-rebuy')).toBeNull();
  });
});

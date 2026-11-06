// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { RSI_GAMES_LIBRARY_URL } from '@/config';
import type { Pledge } from '../pledge';
import { toPledgeView } from '../pledge-view';
import PledgeRow from './PledgeRow.vue';

let app: App | undefined;
afterEach(() => app?.unmount());

function render(overrides: Partial<Pledge>) {
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
    render: () => h(PledgeRow, { pledge: toPledgeView(pledge), autoExpand: true }),
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
  it('marks a protected pledge with a lock tag and links the Games Library', async () => {
    const root = render({
      protectedGames: ['SC', 'SQ42'],
      isGiftable: false,
      isExchangeable: false,
      items: [{ title: 'Nomad', kind: 'Ship' }],
    });

    const lock = root.querySelector('.shm-badge.is-protected');
    expect(lock?.textContent?.trim()).toBe('SC · SQ42');
    expect(lock?.querySelector('.shm-icon')).not.toBeNull();
    // The tooltip is teleported out of the row (which clips it) and opens on hover and focus.
    const tooltip = document.getElementById(lock!.getAttribute('aria-describedby')!)!;
    expect(tooltip.getAttribute('role')).toBe('tooltip');
    expect(tooltip.hidden).toBe(true);
    expect(tooltip.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Protected game access RSI protects this pledge as your game access for Star Citizen and ' +
        "Squadron 42. It can't be melted or gifted, but you can still upgrade it with CCUs.",
    );
    lock!.dispatchEvent(new Event('mouseenter'));
    await nextTick();
    expect(tooltip.hidden).toBe(false);
    lock!.dispatchEvent(new Event('mouseleave'));
    await nextTick();
    expect(tooltip.hidden).toBe(true);
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
    const tooltip = document.getElementById(lock!.getAttribute('aria-describedby')!);
    expect(tooltip?.textContent?.replace(/\s+/g, ' ')).toContain(
      "for Squadron 42. It can't be melted or gifted, and as it contains no ship, it can't be " +
        'upgraded with CCUs either.',
    );
  });

  it('names only the game of a pledge that protects Star Citizen alone', () => {
    const root = render({ protectedGames: ['SC'], items: [{ title: 'Aurora MR', kind: 'Ship' }] });
    const lock = root.querySelector('.shm-badge.is-protected');
    expect(lock?.textContent?.trim()).toBe('SC');
    const tooltip = document.getElementById(lock!.getAttribute('aria-describedby')!);
    expect(tooltip?.textContent).toContain('for Star Citizen.');
    expect(tooltip?.textContent).not.toContain('Squadron 42');
  });

  it('names only the game of a pledge that protects Squadron 42 alone', () => {
    const root = render({
      protectedGames: ['SQ42'],
      items: [{ title: 'Aurora MR', kind: 'Ship' }],
    });
    const lock = root.querySelector('.shm-badge.is-protected');
    expect(lock?.textContent?.trim()).toBe('SQ42');
    const tooltip = document.getElementById(lock!.getAttribute('aria-describedby')!);
    expect(tooltip?.textContent).toContain('for Squadron 42.');
    expect(tooltip?.textContent).not.toContain('Star Citizen');
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
});

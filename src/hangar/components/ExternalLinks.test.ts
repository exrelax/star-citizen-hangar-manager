// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, type App } from 'vue';
import type { ShipRef } from '../pledge-view';
import ExternalLinks from './ExternalLinks.vue';

let app: App | undefined;
afterEach(() => app?.unmount());

function render(ships: ShipRef[]) {
  const root = document.createElement('div');
  app = createApp({ render: () => h(ExternalLinks, { ships }) });
  app.mount(root);
  return root;
}

const polaris: ShipRef = {
  name: 'Polaris',
  link: { fleetyards: 'polaris', erkul: 'rsi_polaris' },
};

describe('ExternalLinks', () => {
  it('shows labelled buttons for the links of a single ship', () => {
    const root = render([polaris]);
    expect(root.querySelector('.shm-external-label')?.textContent).toBe('External links:');
    const buttons = [...root.querySelectorAll('a')];
    expect(buttons.map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['erkul.games', 'https://www.erkul.games/ship/rsi_polaris'],
      ['FleetYards.net', 'https://fleetyards.net/ships/polaris/'],
    ]);
    expect(buttons.every((a) => a.querySelector('img'))).toBe(true);
    // One ship: no need to name it.
    expect(root.querySelector('.shm-external-ship-name')).toBeNull();
  });

  it('names the ships when there are several, and skips ships without links', () => {
    const root = render([
      polaris,
      { name: 'Unknown Ship' },
      { name: 'Cutlass Black', link: { fleetyards: 'cutlass-black' } },
    ]);
    const names = [...root.querySelectorAll('.shm-external-ship-name')].map((el) => el.textContent);
    expect(names).toEqual(['Polaris', 'Cutlass Black']);
    // No erkul id known for the Cutlass: only its FleetYards button.
    expect(root.querySelectorAll('a')).toHaveLength(3);
  });

  it('renders nothing without any links', () => {
    expect(render([{ name: 'Unknown Ship' }]).querySelector('.shm-external-links')).toBeNull();
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, shallowRef, type App } from 'vue';
import { DEMO_CONTEXT, type DemoContext } from '@/demo/use-demo';
import ShipUpgradeButtons from './ShipUpgradeButtons.vue';

/* The buttons that open RSI's ship upgrade dialog (#391, #392, #374). */

let app: App | undefined;
afterEach(() => {
  app?.unmount();
  app = undefined;
});

function mount(props: Record<string, unknown>, demo = false) {
  const root = document.createElement('div');
  app = createApp({ render: () => h(ShipUpgradeButtons, props) });
  app.provide(DEMO_CONTEXT, shallowRef(demo ? ({} as DemoContext) : null));
  app.mount(root);
  return [...root.querySelectorAll<HTMLElement>('.shm-upgrade-buttons > *')];
}

describe('ShipUpgradeButtons', () => {
  it('opens the dialog without a preset ship in My Hangar (#374)', () => {
    const [button, ...others] = mount({});
    expect(others).toEqual([]);
    expect(button?.textContent?.trim()).toBe('Ship upgrade');
    expect(button?.classList.contains('js-open-ship-upgrades')).toBe(true);
    expect(button?.dataset.apiurl).toBe('/pledge-store/api/upgrade/v2');
    expect(button?.hasAttribute('data-toshipid')).toBe(false);
    expect(button?.hasAttribute('data-toskuid')).toBe(false);
    expect(button?.querySelector('use')?.getAttribute('href')).toContain('basket-shopping');
  });

  it('shows "Warbond upgrade" left of "Ship upgrade", each with its SKU (#392)', () => {
    const buttons = mount({ shipId: 45, shipName: 'Andromeda', skuId: 901, warbondSkuId: 900 });
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Warbond upgrade',
      'Ship upgrade',
    ]);
    expect(buttons.map((button) => button.dataset.toskuid)).toEqual(['900', '901']);
    expect(buttons.every((button) => button.dataset.toshipid === '45')).toBe(true);
  });

  it('shows nothing for a ship without SKUs', () => {
    expect(mount({ shipId: 45, shipName: 'Andromeda' })).toEqual([]);
  });

  it('is disabled in the demo, also without a preset ship (#388)', () => {
    const [button] = mount({}, true);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button?.classList.contains('js-open-ship-upgrades')).toBe(false);
  });
});

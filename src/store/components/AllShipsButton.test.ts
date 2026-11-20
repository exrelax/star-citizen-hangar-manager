// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createApp, h, nextTick, type App } from 'vue';
import { withDefaults } from '@/settings/settings';
import { SHIPS_VERSION, shipsItem, warbondsItem } from '@/ships/ships-storage';
import AllShipsButton from './AllShipsButton.vue';

const refresh = vi.hoisted(() => ({
  result: 'read' as 'read' | 'failed' | 'signedOut',
  store: true,
  error: undefined as string | undefined,
}));

vi.mock('@/ships/sync-upgrade-tool', async () => {
  const { reactive } = await import('vue');
  const { SHIPS_VERSION, shipsItem, warbondsItem } = await import('@/ships/ships-storage');
  const state = reactive({ loading: false, error: undefined as string | undefined });
  return {
    upgradeToolState: state,
    refreshUpgradeTool: vi.fn(async () => {
      if (refresh.store) {
        await shipsItem.setValue({
          version: SHIPS_VERSION,
          ships: [{ id: 1, name: 'Aurora MR', msrp: 25 }],
        });
        await warbondsItem.setValue({ version: SHIPS_VERSION, warbonds: [] });
      }
      state.error = refresh.error;
      return refresh.result;
    }),
  };
});

// The overlay stands for itself: only whether it opens counts here.
vi.mock('./AllShipsOverlay.vue', () => ({
  default: { render: () => h('div', { class: 'overlay' }) },
}));

let app: App | undefined;
afterEach(() => app?.unmount());
beforeEach(() => {
  fakeBrowser.reset();
  Object.assign(refresh, { result: 'read', store: true, error: undefined });
});

async function settle() {
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
  }
}

async function render() {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp(AllShipsButton, {
    pledges: [],
    buyback: [],
    settings: withDefaults({}),
    hangarRead: true,
    buybackRead: true,
  });
  app.mount(root);
  await settle();
  return root;
}

describe('"All ships" above the manager (#452)', () => {
  it('opens the table at once with the Pledge Store data stored', async () => {
    await shipsItem.setValue({
      version: SHIPS_VERSION,
      ships: [{ id: 1, name: 'Aurora MR', msrp: 25 }],
    });
    await warbondsItem.setValue({ version: SHIPS_VERSION, warbonds: [] });
    const root = await render();
    root.querySelector('button')!.click();
    await settle();
    expect(root.querySelector('.overlay')).not.toBeNull();
  });

  it('reads the Pledge Store data first, spinning, then opens the table', async () => {
    const root = await render();
    root.querySelector('button')!.click();
    await nextTick();
    expect(root.querySelector('button')!.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector('.shm-refresh-icon.is-spinning')).not.toBeNull();
    await settle();
    expect(root.querySelector('.overlay')).not.toBeNull();
    expect(root.querySelector('button')!.disabled).toBe(false);
  });

  it('says so when the read fails, and opens nothing', async () => {
    Object.assign(refresh, { result: 'failed', store: false, error: 'HTTP 503' });
    const root = await render();
    root.querySelector('button')!.click();
    await settle();
    expect(root.querySelector('.overlay')).toBeNull();
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('HTTP 503');
  });
});

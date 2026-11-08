// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { SIDEBAR_BOXES } from '@/hangar/sidebar';
import { DEFAULT_SETTINGS, type Settings } from '../settings';
import SidebarSection from './SidebarSection.vue';

let app: App | undefined;
afterEach(() => app?.unmount());

function render(settings: Partial<Settings>) {
  const root = document.createElement('div');
  const updates: Partial<Settings>[] = [];
  app = createApp({
    render: () =>
      h(SidebarSection, {
        settings: { ...DEFAULT_SETTINGS, ...settings },
        onUpdate: (patch: Partial<Settings>) => updates.push(patch),
      }),
  });
  app.mount(root);
  const reset = () =>
    [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Reset order'),
    );
  return { reset, updates };
}

describe('SidebarSection', () => {
  it('offers no reset while the boxes are in their default order', async () => {
    const { reset } = render({});
    await nextTick();
    expect(reset()).toBeUndefined();
  });

  it('resets only the order of the boxes', async () => {
    const { reset, updates } = render({
      sidebarOrder: [...SIDEBAR_BOXES].reverse(),
      sidebarHidden: ['summary'],
      sidebarCollapsed: ['notifications'],
    });
    await nextTick();
    reset()?.click();
    // Shown and collapsed boxes aren't part of the change.
    expect(updates).toEqual([{ sidebarOrder: [...SIDEBAR_BOXES] }]);
  });

  it('keeps the reset disabled while the sidebar is off', async () => {
    const { reset } = render({ sidebar: false, sidebarOrder: [...SIDEBAR_BOXES].reverse() });
    await nextTick();
    expect(reset()?.disabled).toBe(true);
  });
});

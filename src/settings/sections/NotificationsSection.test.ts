// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createApp, nextTick, type App } from 'vue';
import { dismissedPaintsItem } from '@/store/paint-consultant/paint-notification';
import { withDefaults, type Settings } from '../settings';
import NotificationsSection from './NotificationsSection.vue';

let app: App | undefined;
afterEach(() => app?.unmount());
beforeEach(() => fakeBrowser.reset());

async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await nextTick();
  }
}

async function render(
  settings: Settings = withDefaults({}),
  onUpdate: (patch: Partial<Settings>) => void = () => undefined,
) {
  const root = document.createElement('div');
  app = createApp(NotificationsSection, { settings, onUpdate });
  app.mount(root);
  await settle();
  return root;
}

describe('NotificationsSection', () => {
  it('shows dismissed paint notifications again', async () => {
    await dismissedPaintsItem.setValue([1, 2]);
    const root = await render();
    const button = root.querySelector('button')!;
    expect(button.disabled).toBe(false);

    button.click();
    await settle();
    expect(await dismissedPaintsItem.getValue()).toEqual([]);
    expect(button.disabled).toBe(true);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Shown again');
  });

  it('has nothing to show again without dismissed paints', async () => {
    const root = await render();
    expect(root.querySelector('button')!.disabled).toBe(true);
    expect(root.textContent).toContain('No paint notification is dismissed');
  });

  it('turns the kinds of notifications on and off (#197)', async () => {
    const updates: Partial<Settings>[] = [];
    const root = await render(withDefaults({ notificationsOff: ['storeItems'] }), (patch) =>
      updates.push(patch),
    );
    const checks = [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const byLabel = (text: string) =>
      checks.find((check) => check.closest('label')?.textContent?.includes(text))!;
    // Browser only: off while the browser doesn't allow notifications.
    expect(byLabel('Marked pledges can be melted').disabled).toBe(true);
    expect(byLabel('Pledge Store items changed').checked).toBe(false);
    const warbonds = byLabel('Warbond CCUs changed');
    warbonds.checked = false;
    warbonds.dispatchEvent(new Event('change'));
    expect(updates).toEqual([{ notificationsOff: ['warbonds', 'storeItems'] }]);
  });
});

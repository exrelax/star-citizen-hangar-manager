// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createApp, nextTick, type App } from 'vue';
import { dismissedPaintsItem } from '@/store/paint-consultant/paint-notification';
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

async function render() {
  const root = document.createElement('div');
  app = createApp(NotificationsSection);
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
});

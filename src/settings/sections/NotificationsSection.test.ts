// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createApp, nextTick, type App } from 'vue';
import { EVENTS_VERSION, eventsItem } from '@/events/events-storage';
import {
  browserNotificationsHintDismissedItem,
  browserNotificationsItem,
} from '@/notifications/browser-permission';
import { notificationsItem } from '@/notifications/notifications';
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
  it('shows checked-off notifications again while they still matter (#213)', async () => {
    const now = Date.now();
    await eventsItem.setValue({
      version: EVENTS_VERSION,
      events: [
        {
          id: 'shown',
          name: { en: 'Shown' },
          eventStart: now + 60_000,
          eventEnd: now + 120_000,
          displayStart: now - 60_000,
          displayEnd: now + 120_000,
        },
      ],
    });
    await notificationsItem.setValue([
      { id: 'events:shown', kind: 'events', text: 'Shown', at: now, doneAt: now },
      { id: 'events:over', kind: 'events', text: 'Over', at: now, doneAt: now },
    ]);
    await browserNotificationsItem.setValue(false);
    await browserNotificationsHintDismissedItem.setValue(true);
    const root = await render();
    const button = root.querySelector('button')!;
    expect(button.disabled).toBe(false);

    button.click();
    await settle();
    const notes = await notificationsItem.getValue();
    expect(notes.find((note) => note.id === 'events:shown')?.doneAt).toBeUndefined();
    expect(notes.find((note) => note.id === 'events:over')?.doneAt).toBe(now);
    expect(await browserNotificationsHintDismissedItem.getValue()).toBe(false);
    expect(button.disabled).toBe(true);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('2 shown again');
  });

  it('has nothing to show again without checked-off notifications that matter', async () => {
    const root = await render();
    expect(root.querySelector('button')!.disabled).toBe(true);
    expect(root.textContent).toContain('No checked-off notification still matters');
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

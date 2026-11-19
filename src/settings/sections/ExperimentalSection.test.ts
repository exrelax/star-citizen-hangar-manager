// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { DEFAULT_SETTINGS, type Settings } from '../settings';
import ExperimentalSection from './ExperimentalSection.vue';

let app: App | undefined;
afterEach(() => {
  app?.unmount();
  document.body.replaceChildren();
});

function render(settings: Partial<Settings>) {
  // In the document, so the focus can move.
  const root = document.body.appendChild(document.createElement('div'));
  const updates: Partial<Settings>[] = [];
  app = createApp({
    render: () =>
      h(ExperimentalSection, {
        settings: { ...DEFAULT_SETTINGS, ...settings },
        onUpdate: (patch: Partial<Settings>) => updates.push(patch),
      }),
  });
  app.mount(root);
  const bulkSwitch = () => root.querySelector<HTMLInputElement>('input[role="switch"]')!;
  const button = (text: string) =>
    [...root.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === text);
  const question = () => root.querySelector('.shm-experimental-confirm');
  /** As a click on the switch: it flips, then reports the change. */
  const toggle = () => {
    const input = bulkSwitch();
    input.checked = !input.checked;
    input.dispatchEvent(new Event('change'));
  };
  return { bulkSwitch, button, question, toggle, updates };
}

describe('ExperimentalSection: bulk melting', () => {
  it('asks before turning it on, and only "Turn on" turns it on', async () => {
    const { bulkSwitch, button, question, toggle, updates } = render({ bulkMelting: false });
    toggle();
    await nextTick();
    await nextTick();
    expect(updates).toEqual([]);
    expect(question()?.textContent).toContain('macro');
    // The switch stays off while it asks, and "Cancel" has the focus.
    expect(bulkSwitch().checked).toBe(false);
    expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
    button('Turn on')!.click();
    await nextTick();
    expect(updates).toEqual([{ bulkMelting: true }]);
    expect(question()).toBeNull();
  });

  it('keeps it off on "Cancel"', async () => {
    const { bulkSwitch, button, question, toggle, updates } = render({ bulkMelting: false });
    toggle();
    await nextTick();
    button('Cancel')!.click();
    await nextTick();
    expect(updates).toEqual([]);
    expect(question()).toBeNull();
    expect(bulkSwitch().checked).toBe(false);
  });

  it('turns it off without asking', async () => {
    const { question, toggle, updates } = render({ bulkMelting: true });
    toggle();
    await nextTick();
    expect(updates).toEqual([{ bulkMelting: false }]);
    expect(question()).toBeNull();
  });
});

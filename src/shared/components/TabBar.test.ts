// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import TabBar from './TabBar.vue';

let app: App | undefined;
afterEach(() => app?.unmount());

async function render(selected: string) {
  const root = document.createElement('div');
  document.body.append(root);
  app = createApp(TabBar, {
    items: [
      { id: 'hangar', label: 'My Hangar', icon: 'list' },
      { id: 'settings', label: 'Hangar Manager Settings', icon: 'gear', iconOnly: true },
    ],
    selected,
    label: 'Hangar Manager',
    panels: 'shm',
  });
  app.mount(root);
  await nextTick();
  return [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
}

describe('a tab with only its icon (#513)', () => {
  it('shows no text, names itself and keeps its tab semantics', async () => {
    const [hangar, settings] = await render('settings');
    expect(hangar!.textContent!.trim()).toBe('My Hangar');
    expect(settings!.textContent!.trim()).toBe('');
    expect(settings!.getAttribute('aria-label')).toBe('Hangar Manager Settings');
    expect(settings!.getAttribute('aria-selected')).toBe('true');
    expect(settings!.id).toBe('shm-tab-settings');
    expect(settings!.classList.contains('is-icon-only')).toBe(true);
    expect(hangar!.hasAttribute('aria-label')).toBe(false);
  });
});

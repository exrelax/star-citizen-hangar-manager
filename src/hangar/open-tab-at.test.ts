// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTabAt } from './open-tab-at';
import { hashOfTab } from './route';
import { DEMO_SETTINGS_ID } from '@/settings/anchors';
import { REVEAL_EVENT } from '@/settings/categories';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'requestAnimationFrame'] });
  document.body.innerHTML = '';
});
afterEach(() => vi.useRealTimers());

function target(id: string) {
  const element = document.createElement('div');
  element.id = id;
  element.scrollIntoView = vi.fn();
  document.body.append(element);
  return element;
}

describe('openTabAt', () => {
  it('switches the tab and scrolls to the element once it is there', () => {
    openTabAt('settings', 'shm-later');
    expect(location.hash).toBe(hashOfTab('settings'));

    // The tab is built a few frames later.
    vi.advanceTimersToNextFrame();
    const element = target('shm-later');
    vi.advanceTimersToNextFrame();
    expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('marks the element for a moment only when asked to', () => {
    const plain = target('shm-plain');
    openTabAt('store', 'shm-plain');
    vi.advanceTimersToNextFrame();
    expect(plain.classList.contains('is-flashed')).toBe(false);

    const marked = target('shm-marked');
    openTabAt('settings', 'shm-marked', { highlight: true });
    vi.advanceTimersToNextFrame();
    expect(marked.classList.contains('is-flashed')).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(marked.classList.contains('is-flashed')).toBe(false);
  });

  it('shows the demo settings category before scrolling to it (#278)', () => {
    const panel = target(DEMO_SETTINGS_ID);
    expect(DEMO_SETTINGS_ID).toBe('shm-settings-demo');
    panel.dataset.shmReveal = '';
    panel.style.display = 'none';
    panel.addEventListener(REVEAL_EVENT, () => (panel.style.display = ''));

    openTabAt('settings', DEMO_SETTINGS_ID, { highlight: true });
    vi.advanceTimersToNextFrame();
    expect(panel.scrollIntoView).not.toHaveBeenCalled();
    vi.advanceTimersToNextFrame();
    expect(panel.scrollIntoView).toHaveBeenCalled();
    expect(panel.classList.contains('is-flashed')).toBe(true);
  });

  it('gives up when the element never shows', () => {
    openTabAt('settings', 'shm-missing');
    for (let i = 0; i < 40; i++) vi.advanceTimersToNextFrame();
    expect(vi.getTimerCount()).toBe(0);
  });
});

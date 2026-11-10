import { REVEAL_EVENT } from '@/settings/categories';
import { hashOfTab, type ManagerTab } from './route';

/*
 * Switches to a tab of the manager and scrolls to an element in it, e.g. the Paint Discount
 * Consultant in the Pledge Store tab or a setting in the settings tab. The element gets a
 * `scroll-margin-top` to clear RSI's header.
 */

/** Frames to wait for the element: the tab may be built on first use. */
const MAX_FRAMES = 30;
/** Scrolls again while the tab above the element still grows. */
const SETTLE_STEPS = 5;
const SETTLE_MS = 400;
/** How long `highlight` marks the element (`is-flashed`). */
const FLASH_MS = 1600;

export function openTabAt(
  tab: ManagerTab,
  elementId: string,
  { highlight = false }: { highlight?: boolean } = {},
): void {
  location.hash = hashOfTab(tab);
  let frames = 0;
  const find = () => {
    const element = document.getElementById(elementId);
    // A setting in a category that isn't shown: its category comes first (src/settings/categories.ts).
    const hidden = element?.closest<HTMLElement>('[data-shm-reveal]');
    if (element && hidden?.style.display === 'none') {
      hidden.dispatchEvent(new CustomEvent(REVEAL_EVENT));
      if (++frames < MAX_FRAMES) requestAnimationFrame(find);
    } else if (element) {
      settle(element);
      if (highlight) flash(element);
    } else if (++frames < MAX_FRAMES) requestAnimationFrame(find);
  };
  requestAnimationFrame(find);
}

/**
 * Scrolls `element` to the top, and again while the tab above it still grows (its list being
 * built): a smooth scroll alone would stop at the place the element had when it started.
 */
function settle(element: HTMLElement, attempt = 0) {
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  const atBottom = scrollY >= document.documentElement.scrollHeight - innerHeight - 1;
  if (attempt > 0 && (Math.abs(element.getBoundingClientRect().top - margin) < 4 || atBottom)) {
    return;
  }
  element.scrollIntoView({ behavior: attempt === 0 ? 'smooth' : 'auto', block: 'start' });
  if (attempt < SETTLE_STEPS) setTimeout(() => settle(element, attempt + 1), SETTLE_MS);
}

/** Marks `element` for a moment, so the eye finds it after the scroll. */
function flash(element: HTMLElement) {
  element.classList.remove('is-flashed');
  // Restarts the animation when the same element is opened again.
  void element.offsetWidth;
  element.classList.add('is-flashed');
  setTimeout(() => element.classList.remove('is-flashed'), FLASH_MS);
}

/** Room kept below a sticky element to the window's bottom edge. */
const BOTTOM_GAP = 16;

/**
 * Whether a sticky element at `top` (its CSS `top`) with `height` fits into a window of
 * `windowHeight`: otherwise its lower part could never be reached while it sticks.
 */
export const fitsWindow = (top: number, height: number, windowHeight: number) =>
  top + height + BOTTOM_GAP <= windowHeight;

/**
 * Lets a `position: sticky` element stick only while it fits into the window: otherwise it gets
 * the class `is-unstuck` (which should make it scroll with the page) – again with every change of
 * its height or of the window. Returns the function that stops this.
 */
export function stickWhileFits(element: HTMLElement): () => void {
  const check = () => {
    const top = parseFloat(getComputedStyle(element).top) || 0;
    element.classList.toggle('is-unstuck', !fitsWindow(top, element.offsetHeight, innerHeight));
  };
  const observer = new ResizeObserver(check);
  observer.observe(element);
  addEventListener('resize', check);
  check();
  return () => {
    observer.disconnect();
    removeEventListener('resize', check);
  };
}

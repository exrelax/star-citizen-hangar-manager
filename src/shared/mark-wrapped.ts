import type { Directive } from 'vue';

/*
 * `v-mark-wrapped`: tells whether a flex row of items (e.g. buttons) fits on one line. It lays the
 * row out without the class first, and adds `is-wrapped` while an item had to go to the next line –
 * so the styles can lay it out differently then (e.g. indent the stacked buttons). Checked again
 * when its parent's size or the component changes (other texts, another language).
 */

const WRAPPED = 'is-wrapped';
const observers = new WeakMap<HTMLElement, ResizeObserver>();

/** Whether an item of `row` starts below the first one, measured without the class. */
export function markWrapped(row: HTMLElement): void {
  row.classList.remove(WRAPPED);
  const items = [...row.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  const first = items[0];
  const wrapped = !!first && items.some((item) => item.offsetTop > first.offsetTop);
  row.classList.toggle(WRAPPED, wrapped);
}

export const vMarkWrapped: Directive<HTMLElement> = {
  mounted(row) {
    markWrapped(row);
    const observer = new ResizeObserver(() => markWrapped(row));
    observer.observe(row.parentElement ?? row);
    observers.set(row, observer);
  },
  updated(row) {
    markWrapped(row);
  },
  unmounted(row) {
    observers.get(row)?.disconnect();
    observers.delete(row);
  },
};

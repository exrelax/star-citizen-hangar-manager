import { createApp, markRaw, reactive, type Component, type Directive } from 'vue';
import TooltipOverlay from './TooltipOverlay.vue';

/*
 * The manager's own tooltips, in place of native `title` attributes: in the theme and text size of
 * the settings, and right away. `v-tooltip="text"` or `v-tooltip="{ title, text }"` on any
 * element; one shared overlay (TooltipOverlay.vue) shows the tooltip of the element under the
 * mouse or with keyboard focus. The overlay is teleported out of the manager, since the rows clip
 * what sticks out (`content-visibility`, rounded cards).
 *
 * `{ text, card }` shows a component as a larger card instead of the text (#426), e.g. the details
 * of a pledge; `text` stays its accessible description. A card also opens with a tap, and closes
 * with a tap elsewhere.
 */

/** A component shown as the tooltip, with its props. */
export interface TooltipCard {
  component: Component;
  props: Record<string, unknown>;
}

export type TooltipValue =
  string | { title?: string; text: string; card?: TooltipCard } | null | undefined;

export interface TooltipContent {
  title?: string;
  text: string;
  card?: TooltipCard;
}

/** Delay before a tooltip shows under the mouse; none while another one is open. */
export const SHOW_DELAY_MS = 250;

/** The open tooltip, read by the overlay. */
export const tooltipState = reactive({
  content: undefined as TooltipContent | undefined,
  anchor: undefined as HTMLElement | undefined,
});

const contents = new WeakMap<HTMLElement, TooltipContent>();
const cleanups = new WeakMap<HTMLElement, () => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let overlayMounted = false;

export function toContent(value: TooltipValue): TooltipContent | undefined {
  if (!value) return undefined;
  const content = typeof value === 'string' ? { text: value } : value;
  if (!content.text && !content.title) return undefined;
  // Not made reactive: a component is no state.
  return content.card
    ? { ...content, card: { ...content.card, component: markRaw(content.card.component) } }
    : content;
}

/** The tooltip of an element as plain text (also its accessible description). */
export function tooltipText(content: TooltipContent): string {
  return [content.title, content.text].filter(Boolean).join(' – ');
}

function mountOverlay() {
  if (overlayMounted) return;
  overlayMounted = true;
  const host = document.createElement('div');
  host.className = 'shm-tooltip-host';
  document.body.append(host);
  createApp(TooltipOverlay).mount(host);
}

export function showTooltip(anchor: HTMLElement) {
  const content = contents.get(anchor);
  clearTimeout(timer);
  if (!content) return;
  mountOverlay();
  tooltipState.anchor = anchor;
  tooltipState.content = content;
  // Fixed to the viewport: scrolling would move the element away from it.
  addEventListener('scroll', hideTooltip, { capture: true, once: true });
  addEventListener('keydown', hideOnEscape, { capture: true });
  if (content.card) addEventListener('pointerdown', hideOnTapElsewhere, { capture: true });
}

/** A card opened with a tap closes with a tap anywhere else. */
function hideOnTapElsewhere(event: PointerEvent) {
  if (!tooltipState.anchor?.contains(event.target as Node)) hideTooltip();
}

export function hideTooltip() {
  clearTimeout(timer);
  tooltipState.anchor = undefined;
  tooltipState.content = undefined;
  removeEventListener('scroll', hideTooltip, { capture: true });
  removeEventListener('keydown', hideOnEscape, { capture: true });
  removeEventListener('pointerdown', hideOnTapElsewhere, { capture: true });
}

function hideOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') hideTooltip();
}

/** Sets the accessible name (elements without text, e.g. icon buttons) or description. */
function describe(el: HTMLElement, content: TooltipContent | undefined) {
  const setByTooltip = 'shmTooltipLabel' in el.dataset;
  const ownLabel = el.hasAttribute('aria-label') && !setByTooltip;
  el.removeAttribute('title');
  if (setByTooltip) {
    el.removeAttribute('aria-label');
    delete el.dataset.shmTooltipLabel;
  }
  el.removeAttribute('aria-description');
  if (!content) return;
  const text = tooltipText(content);
  if (!ownLabel && !el.textContent?.trim()) {
    el.setAttribute('aria-label', text);
    el.dataset.shmTooltipLabel = '';
  } else {
    el.setAttribute('aria-description', text);
  }
}

function update(el: HTMLElement, value: TooltipValue) {
  const content = toContent(value);
  if (content) contents.set(el, content);
  else contents.delete(el);
  describe(el, content);
  if (tooltipState.anchor === el) {
    if (content) tooltipState.content = content;
    else hideTooltip();
  }
}

export const vTooltip: Directive<HTMLElement, TooltipValue> = {
  mounted(el, { value }) {
    update(el, value);
    const enter = (event: PointerEvent) => {
      // A tap fires it too; touch has no hover, so no tooltip there – but a card (see `tap`).
      if (event.pointerType === 'touch' || !contents.has(el)) return;
      clearTimeout(timer);
      if (tooltipState.anchor) showTooltip(el);
      else timer = setTimeout(() => showTooltip(el), SHOW_DELAY_MS);
    };
    const leave = (event?: Event) => {
      // A card stays open for a tap on it, e.g. on its link.
      if (event instanceof PointerEvent && event.pointerType === 'touch') return;
      clearTimeout(timer);
      if (tooltipState.anchor === el) hideTooltip();
    };
    /** A tap opens a card at once; its first tap only opens it, the next one acts. */
    let opening = false;
    const tap = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !contents.get(el)?.card) return;
      if (tooltipState.anchor === el) return;
      opening = true;
      showTooltip(el);
    };
    /** The click of the tap that opened the card doesn't follow a link inside. */
    const click = (event: MouseEvent) => {
      if (!opening) return;
      opening = false;
      event.preventDefault();
    };
    // From the keyboard only: a click focuses a button too.
    const focus = () => el.matches(':focus-visible') && showTooltip(el);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerdown', leave);
    el.addEventListener('pointerdown', tap);
    el.addEventListener('click', click, { capture: true });
    el.addEventListener('focusin', focus);
    el.addEventListener('focusout', leave);
    cleanups.set(el, () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointerdown', leave);
      el.removeEventListener('pointerdown', tap);
      el.removeEventListener('click', click, { capture: true });
      el.removeEventListener('focusin', focus);
      el.removeEventListener('focusout', leave);
      leave();
    });
  },
  // Also when only the text inside changed (aria-label vs. aria-description).
  updated: (el, { value }) => update(el, value),
  unmounted(el) {
    cleanups.get(el)?.();
    cleanups.delete(el);
    contents.delete(el);
  },
};

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
 *
 * `interactive: true` makes a card one to act in, e.g. with a link (#434): it stays open while the
 * mouse moves over to it and while it is over it, Tab on the element moves into it, and Tab past
 * its last control, Escape or a click elsewhere closes it.
 */

/** A component shown as the tooltip, with its props. */
export interface TooltipCard {
  component: Component;
  props: Record<string, unknown>;
}

export type TooltipValue =
  | string
  | { title?: string; text: string; card?: TooltipCard; interactive?: boolean }
  | null
  | undefined;

export interface TooltipContent {
  title?: string;
  text: string;
  card?: TooltipCard;
  /** A card to act in, e.g. with a link: it can be hovered and focused. */
  interactive?: boolean;
}

/** Delay before a tooltip shows under the mouse; none while another one is open. */
export const SHOW_DELAY_MS = 250;
/** Time to move the mouse from the element over to an interactive tooltip. */
export const HIDE_DELAY_MS = 300;

/** The open tooltip, read by the overlay; `overlay` is its element, set by the overlay. */
export const tooltipState = reactive({
  content: undefined as TooltipContent | undefined,
  anchor: undefined as HTMLElement | undefined,
  overlay: undefined as HTMLElement | undefined,
});

const contents = new WeakMap<HTMLElement, TooltipContent>();
const cleanups = new WeakMap<HTMLElement, () => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
/** Focus going back to an element from its closed tooltip, which mustn't open it again. */
let returning: HTMLElement | undefined;

/** Focuses the element without opening its tooltip again. */
function focusQuietly(element: HTMLElement) {
  returning = element;
  element.focus();
  returning = undefined;
}
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
  clearTimeout(hideTimer);
  if (!content) return;
  mountOverlay();
  tooltipState.anchor = anchor;
  tooltipState.content = content;
  // Fixed to the viewport: scrolling would move the element away from it.
  addEventListener('scroll', hideTooltip, { capture: true, once: true });
  addEventListener('keydown', hideOnEscape, { capture: true });
  if (content.card) addEventListener('pointerdown', hideOnTapElsewhere, { capture: true });
}

/** A card opened with a tap closes with a tap anywhere else (not in an interactive one). */
function hideOnTapElsewhere(event: PointerEvent) {
  const target = event.target as Node;
  if (tooltipState.anchor?.contains(target) || tooltipState.overlay?.contains(target)) return;
  hideTooltip();
}

const isInteractive = () => !!tooltipState.content?.interactive;

/** Closes an interactive tooltip a moment later, unless the mouse or focus reaches it. */
export function hideTooltipSoon() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideTooltip, HIDE_DELAY_MS);
}

/** The mouse or focus is in the interactive tooltip: it stays open. */
export function keepTooltip() {
  clearTimeout(hideTimer);
}

/** The controls of an interactive tooltip, in their order. */
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
const controlsOf = (element: HTMLElement | undefined) => [
  ...(element?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
];

/** The next control of the page after `element`, to go on with after its tooltip's last one. */
function focusAfter(element: HTMLElement) {
  const all = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (candidate) => candidate.tabIndex >= 0 && !tooltipState.overlay?.contains(candidate),
  );
  const next = all.find(
    (candidate) =>
      element.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING &&
      !element.contains(candidate),
  );
  if (next) next.focus();
  else focusQuietly(element);
}

/** Tab, Shift+Tab and Escape inside an interactive tooltip (see the overlay). */
export function onTooltipKey(event: KeyboardEvent) {
  const anchor = tooltipState.anchor;
  if (!anchor || !isInteractive()) return;
  const controls = controlsOf(tooltipState.overlay);
  const index = controls.indexOf(document.activeElement as HTMLElement);
  if (event.key === 'Escape') {
    event.preventDefault();
    hideTooltip();
    focusQuietly(anchor);
  } else if (event.key === 'Tab' && event.shiftKey && index <= 0) {
    event.preventDefault();
    focusQuietly(anchor);
  } else if (event.key === 'Tab' && !event.shiftKey && index === controls.length - 1) {
    event.preventDefault();
    hideTooltip();
    focusAfter(anchor);
  }
}

/**
 * Focus left the interactive tooltip or its element: it closes unless focus went from one to the
 * other. Checked once focus has moved, as not every focus change tells where it goes.
 */
export function hideUnlessFocusInside() {
  void Promise.resolve().then(() => {
    const focused = document.activeElement;
    if (!tooltipState.anchor || !isInteractive()) return;
    if (tooltipState.overlay?.contains(focused) || tooltipState.anchor.contains(focused)) return;
    hideTooltip();
  });
}

export function hideTooltip() {
  clearTimeout(hideTimer);
  clearTimeout(timer);
  tooltipState.anchor = undefined;
  tooltipState.content = undefined;
  removeEventListener('scroll', hideTooltip, { capture: true });
  removeEventListener('keydown', hideOnEscape, { capture: true });
  removeEventListener('pointerdown', hideOnTapElsewhere, { capture: true });
}

function hideOnEscape(event: KeyboardEvent) {
  // Inside an interactive tooltip its own keys close it and return focus (`onTooltipKey`).
  if (tooltipState.overlay?.contains(event.target as Node)) return;
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
      if (tooltipState.anchor !== el) return;
      // An interactive one stays open on the way to it, and while focus moves into it.
      if (isInteractive() && event?.type === 'pointerleave') return hideTooltipSoon();
      if (isInteractive() && event instanceof FocusEvent) return hideUnlessFocusInside();
      hideTooltip();
    };
    /** Tab on the element moves into its interactive tooltip, if open. */
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.shiftKey || tooltipState.anchor !== el) return;
      if (!isInteractive()) return;
      const first = controlsOf(tooltipState.overlay)[0];
      if (!first) return;
      event.preventDefault();
      first.focus();
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
    const focus = () => returning !== el && el.matches(':focus-visible') && showTooltip(el);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerdown', leave);
    el.addEventListener('pointerdown', tap);
    el.addEventListener('click', click, { capture: true });
    el.addEventListener('focusin', focus);
    el.addEventListener('focusout', leave);
    el.addEventListener('keydown', key);
    cleanups.set(el, () => {
      el.removeEventListener('keydown', key);
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

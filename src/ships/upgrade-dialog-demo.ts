/*
 * RSI's ship upgrade dialog in the demo mode (#586). Each side of the dialog, base ships ("From")
 * and target ships ("To"), chooses between "My ships" – the real account's ships – and "All
 * ships":
 *
 *   .ShipSelector.from / .to
 *     .ShipSearch-radiobutton-ownership       the choice, "My ships" first, "All ships" second
 *       .RadioButton(.checked) > input + label
 *
 * In the demo, "My ships" is disabled with a tooltip, and the base ships' side switches to "All
 * ships" once when it opens on "My ships". The items of a side show only once it is on "All
 * ships": a class on the page's root hides them by CSS (`style.css`) until the side is marked,
 * so the real ships never show, not even for a moment. When the markup doesn't fit, the items
 * stay hidden and a mismatch is reported.
 */

const MODAL = '.ShipUpgradeModal';
const SIDES = '.ShipSelector.from, .ShipSelector.to';
const FROM_CLASS = 'from';
const OWNERSHIP = '.ShipSearch-radiobutton-ownership';
const RADIO = '.RadioButton';
const ITEM = '.ShipItem';
/** On the page's root while the demo mode is on: hides the items of unmarked sides. */
export const DEMO_CLASS = 'shm-upgrade-demo';
/** On a side shown with "All ships". */
export const ALL_SHIPS_ATTRIBUTE = 'data-shm-all-ships';
/** On a "My ships" choice disabled by the demo. */
const DISABLED_ATTRIBUTE = 'data-shm-demo-disabled';

/** The base ships' sides switched to "All ships" once already: the user's later choice stays. */
const switched = new WeakSet<Element>();

const isChecked = (radio: Element) =>
  radio.classList.contains('checked') || !!radio.querySelector<HTMLInputElement>('input')?.checked;

/** Gives "My ships" back as RSI made it. */
function enable(radio: Element): void {
  if (!radio.hasAttribute(DISABLED_ATTRIBUTE)) return;
  radio.removeAttribute(DISABLED_ATTRIBUTE);
  radio.removeAttribute('title');
  radio.removeAttribute('aria-description');
  const input = radio.querySelector<HTMLInputElement>('input');
  if (input) input.disabled = false;
}

function disable(radio: Element, hint: string): void {
  radio.setAttribute(DISABLED_ATTRIBUTE, '');
  if (radio.getAttribute('title') !== hint) {
    radio.setAttribute('title', hint);
    radio.setAttribute('aria-description', hint);
  }
  const input = radio.querySelector<HTMLInputElement>('input');
  if (input && !input.disabled) input.disabled = true;
}

/** Sets the page's root class: the items of unmarked sides hide at once. */
export function setDemoClass(root: Document, active: boolean): void {
  root.documentElement.classList.toggle(DEMO_CLASS, active);
}

/**
 * Applies the demo mode to every side of an open dialog: "My ships" disabled, the base ships on
 * "All ships", the sides on "All ships" marked; outside the demo, "My ships" enabled again.
 * Returns why the markup doesn't fit, if it doesn't.
 */
export function applyDemoShips(root: Document, active: boolean, hint: string): string | undefined {
  setDemoClass(root, active);
  let mismatch: string | undefined;
  for (const side of root.querySelectorAll(`${MODAL} :is(${SIDES})`)) {
    const radios = [
      ...(side.querySelector(OWNERSHIP)?.querySelectorAll(`:scope > ${RADIO}`) ?? []),
    ];
    if (radios.length !== 2) {
      // A side without the choice keeps what it showed; with ships but never marked it stays hidden.
      if (active && !side.hasAttribute(ALL_SHIPS_ATTRIBUTE) && side.querySelector(ITEM)) {
        mismatch = 'no choice between my ships and all ships';
      }
      continue;
    }
    const [mine, all] = radios as [Element, Element];
    if (!active) {
      enable(mine);
      continue;
    }
    disable(mine, hint);
    if (isChecked(all) && !isChecked(mine)) {
      side.setAttribute(ALL_SHIPS_ATTRIBUTE, '');
      continue;
    }
    side.removeAttribute(ALL_SHIPS_ATTRIBUTE);
    if (side.classList.contains(FROM_CLASS) && !switched.has(side)) {
      switched.add(side);
      all.querySelector<HTMLInputElement>('input')?.click();
    }
  }
  return mismatch;
}

/** Removes every trace of the demo from the page. */
export function clearDemoShips(root: Document): void {
  setDemoClass(root, false);
  for (const radio of root.querySelectorAll(`[${DISABLED_ATTRIBUTE}]`)) enable(radio);
  for (const side of root.querySelectorAll(`[${ALL_SHIPS_ATTRIBUTE}]`)) {
    side.removeAttribute(ALL_SHIPS_ATTRIBUTE);
  }
}

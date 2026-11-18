import type { ShipFactsLookup } from './ship-facts';

/*
 * The label "Always available" in RSI's own ship upgrade dialog (#401): on each target ship the
 * ship facts of the website (#109) list as always available in the Pledge Store now. The dialog is
 * RSI's (a React overlay, November 2026), opened on "My Gear", in the Pledge Store and from the
 * Hangar Manager. The label is added from outside, watching the dialog, and never changes it
 * otherwise:
 *
 *   .ShipUpgradeModal .ShipSelector.to       the list of target ships (virtualized: items are
 *     .ShipItem[data-store-action-label]     reused for other ships while scrolling)
 *       "Select Mustang Alpha (id: 65) as to ship"
 *       .ShipItem-general-information-name   "Mustang Alpha"
 *       .ShipItem-general-information-status-and-stock   "in stock", where the label goes
 *
 * When the markup doesn't fit any more, nothing shows and `onMismatch` reports it once.
 */

const MODAL = '.ShipUpgradeModal';
const TARGETS = '.ShipSelector.to';
const ITEM = '.ShipItem';
const NAME = '.ShipItem-general-information-name';
const SPOT = '.ShipItem-general-information-status-and-stock';
const LABEL_CLASS = 'shm-always-available-label';

/** How long an opened dialog may lack its target list before it counts as changed markup. */
const MISMATCH_AFTER_MS = 5000;

/** A target ship of the dialog: RSI's id where the item names it, its name. */
export interface UpgradeTarget {
  id?: number;
  name?: string;
}

/** The target ship of an item of the dialog's target list. */
export function targetOf(item: Element): UpgradeTarget {
  const label = item.getAttribute('data-store-action-label') ?? '';
  const id = /\(id:\s*(\d+)\)/.exec(label)?.[1];
  const name = item.querySelector(NAME)?.textContent?.trim();
  return { ...(id && { id: Number(id) }), ...(name && { name }) };
}

const normalized = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Whether a target ship is always available now: by RSI's id, which is the ship facts' id, else by
 * its name (the facts' name or its wiki name). Unknown ships and no facts: not.
 */
export function createAlwaysAvailableCheck(
  facts: ShipFactsLookup | undefined,
): (target: UpgradeTarget) => boolean {
  if (!facts) return () => false;
  const byName = new Map<string, number>();
  for (const ship of facts.facts.ships) {
    for (const name of [ship.name, ship.wikiName]) {
      if (name && !byName.has(normalized(name))) byName.set(normalized(name), ship.id);
    }
  }
  return ({ id, name }) => {
    const shipId = id ?? (name ? byName.get(normalized(name)) : undefined);
    return shipId !== undefined && facts.isAlwaysAvailable(shipId) === true;
  };
}

export interface UpgradeDialogOptions {
  /** The setting is on. */
  enabled: () => boolean;
  isAlwaysAvailable: (target: UpgradeTarget) => boolean;
  /** The label's text and its tooltip, in the language shown. */
  texts: () => { label: string; hint: string };
  /** The dialog's markup doesn't fit: called once. */
  onMismatch: (reason: string) => void;
}

/** Adds, updates or removes the labels of every target ship shown now. */
export function applyLabels(root: ParentNode, options: UpgradeDialogOptions): void {
  const enabled = options.enabled();
  const texts = enabled ? options.texts() : undefined;
  for (const item of root.querySelectorAll(`${MODAL} ${TARGETS} ${ITEM}`)) {
    const existing = item.querySelector<HTMLElement>(`.${LABEL_CLASS}`);
    const target = targetOf(item);
    const show = !!texts && options.isAlwaysAvailable(target);
    if (!show) {
      existing?.remove();
      continue;
    }
    const spot = item.querySelector(SPOT);
    if (!spot) continue;
    const label = existing ?? document.createElement('p');
    label.className = LABEL_CLASS;
    if (label.textContent !== texts.label) label.textContent = texts.label;
    label.title = texts.hint;
    label.setAttribute('aria-description', texts.hint);
    if (label.parentElement !== spot) spot.append(label);
  }
}

/**
 * Watches the page for RSI's ship upgrade dialog and keeps the labels of its target ships; `update`
 * applies a changed setting or ship facts at once. Returns the stop function.
 */
export function watchUpgradeDialog(
  root: Document,
  options: UpgradeDialogOptions,
): { update: () => void; stop: () => void } {
  let frame = 0;
  let reported = false;
  let openedAt: number | undefined;
  const mismatch = (reason: string) => {
    if (reported) return;
    reported = true;
    options.onMismatch(reason);
  };
  const run = () => {
    frame = 0;
    const modal = root.querySelector(MODAL);
    if (!modal) {
      openedAt = undefined;
      return;
    }
    openedAt ??= Date.now();
    const targets = modal.querySelector(TARGETS);
    if (!targets) {
      if (Date.now() - openedAt > MISMATCH_AFTER_MS) mismatch('no list of target ships');
      return;
    }
    const items = [...targets.querySelectorAll(ITEM)];
    if (items.length && items.every((item) => !targetOf(item).id && !targetOf(item).name)) {
      mismatch('no target ship id or name');
    } else if (items.length && !items.some((item) => item.querySelector(SPOT))) {
      mismatch('no place for the label');
    }
    applyLabels(root, options);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(run);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-store-action-label'],
  });
  // An opened dialog without its target list: checked again after the time it may take.
  const timer = setInterval(() => root.querySelector(MODAL) && schedule(), MISMATCH_AFTER_MS);
  schedule();
  return {
    update: schedule,
    stop: () => {
      observer.disconnect();
      clearInterval(timer);
      if (frame) cancelAnimationFrame(frame);
      for (const label of root.querySelectorAll(`.${LABEL_CLASS}`)) label.remove();
    },
  };
}

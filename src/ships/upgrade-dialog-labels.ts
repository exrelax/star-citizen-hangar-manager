import type { ShipFactsLookup } from './ship-facts';

/*
 * The label "Always available" in RSI's own ship upgrade dialog (#401): on each ship, base ship
 * ("From") and target ship ("To"), the ship facts of the website (#109) list as always available
 * in the Pledge Store now. The dialog is
 * RSI's (a React overlay, November 2026), opened on "My Gear", in the Pledge Store and from the
 * Hangar Manager. The label is added from outside, watching the dialog, and never changes it
 * otherwise:
 *
 *   .ShipUpgradeModal .ShipSelector.from     the lists of base and target ships, or the ship
 *   .ShipUpgradeModal .ShipSelector.to       chosen (virtualized: items are reused for other
 *     .ShipItem[data-store-action-label]     ships while scrolling)
 *       "Select Mustang Alpha (id: 65) as to ship"
 *       .ShipItem-general-information-name   "Mustang Alpha"
 *       .ShipItem-general-information-status-and-stock   "in stock", where the label goes
 *
 * On the target ships that aren't always available, while an event runs, a countdown (#570) goes
 * where the label would: how long the ship is expected to stay in the store.
 *
 * On the base ships, the counts of #506 go on the ship's image (`.ShipItem-thumbnail-clip`, bottom
 * left): how often the hangar has the ship and how many CCUs to it the hangar and the buy back
 * have. The items have a fixed height, so nothing may go into their text.
 *
 * When the markup doesn't fit any more, nothing shows and `onMismatch` reports it once.
 */

const MODAL = '.ShipUpgradeModal';
/** Both sides of the dialog, base ships ("From") and target ships ("To"). */
const SELECTORS = '.ShipSelector.from, .ShipSelector.to';
const ITEM = '.ShipItem';
const NAME = '.ShipItem-general-information-name';
const SPOT = '.ShipItem-general-information-status-and-stock';
const LABEL_CLASS = 'shm-always-available-label';
/** The base ships' side, where the counts (#506) go. */
const FROM = '.ShipSelector.from';
const THUMB = '.ShipItem-thumbnail-clip';
const COUNTS_CLASS = 'shm-base-counts';
/** The target ships' side, where the countdowns (#570) go. */
const TO = '.ShipSelector.to';
const COUNTDOWN_CLASS = 'shm-upgrade-countdown';
/** How often an open dialog's countdowns are brought up to date. */
const TICK_MS = 1000;

/** How long an opened dialog may lack its ship lists before it counts as changed markup. */
const MISMATCH_AFTER_MS = 5000;

/** A ship of the dialog: RSI's id where the item names it, its name. */
export interface UpgradeTarget {
  id?: number;
  name?: string;
}

/** The ship of an item of the dialog's lists. */
export function targetOf(item: Element): UpgradeTarget {
  const label = item.getAttribute('data-store-action-label') ?? '';
  const id = /\(id:\s*(\d+)\)/.exec(label)?.[1];
  const name = item.querySelector(NAME)?.textContent?.trim();
  return { ...(id && { id: Number(id) }), ...(name && { name }) };
}

const normalized = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Whether a ship of the dialog is always available now: by RSI's id, which is the ship facts' id,
 * else by its name (the facts' name or its wiki name). `undefined` for an unknown ship or no facts.
 */
export function createAvailabilityOf(
  facts: ShipFactsLookup | undefined,
): (target: UpgradeTarget) => boolean | undefined {
  if (!facts) return () => undefined;
  const byName = new Map<string, number>();
  for (const ship of facts.facts.ships) {
    for (const name of [ship.name, ship.wikiName]) {
      if (name && !byName.has(normalized(name))) byName.set(normalized(name), ship.id);
    }
  }
  return ({ id, name }) => {
    const shipId = id ?? (name ? byName.get(normalized(name)) : undefined);
    return shipId === undefined ? undefined : facts.isAlwaysAvailable(shipId);
  };
}

/** Whether a ship of the dialog is always available now; unknown ships and no facts: not. */
export function createAlwaysAvailableCheck(
  facts: ShipFactsLookup | undefined,
): (target: UpgradeTarget) => boolean {
  const availability = createAvailabilityOf(facts);
  return (target) => availability(target) === true;
}

export interface UpgradeDialogOptions {
  /** The setting is on. */
  enabled: () => boolean;
  isAlwaysAvailable: (target: UpgradeTarget) => boolean;
  /** The label's text and its tooltip, in the language shown. */
  texts: () => { label: string; hint: string };
  /**
   * The counts of a base ship (#506), as its line and tooltip; none while the setting is off or
   * nothing is known of the ship.
   */
  countsOf?: (target: UpgradeTarget) => { text: string; hint: string } | undefined;
  /**
   * The countdown of a target ship (#570): how long it is expected to stay in the store, as its
   * line and tooltip; none while the setting is off, no event runs or it is always available.
   */
  countdownOf?: (target: UpgradeTarget) => { text: string; hint: string } | undefined;
  /** The dialog opened (again): the counts' data can be read now. */
  onOpen?: () => void;
  /** The dialog's markup doesn't fit: called once. */
  onMismatch: (reason: string) => void;
}

/** Adds, updates or removes the labels of every ship shown now, on both sides. */
export function applyLabels(root: ParentNode, options: UpgradeDialogOptions): void {
  const enabled = options.enabled();
  const texts = enabled ? options.texts() : undefined;
  const items = [...root.querySelectorAll(MODAL)].flatMap((modal) =>
    [...modal.querySelectorAll(SELECTORS)].flatMap((side) => [...side.querySelectorAll(ITEM)]),
  );
  for (const item of items) {
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
  applyCounts(root, options);
  applyCountdowns(root, options);
}

/** Adds, updates or removes the countdowns (#570) on every target ship shown now. */
function applyCountdowns(root: ParentNode, options: UpgradeDialogOptions): void {
  const items = [...root.querySelectorAll(MODAL)].flatMap((modal) =>
    [...modal.querySelectorAll(TO)].flatMap((side) => [...side.querySelectorAll(ITEM)]),
  );
  for (const item of items) {
    const existing = item.querySelector<HTMLElement>(`.${COUNTDOWN_CLASS}`);
    const countdown = options.countdownOf?.(targetOf(item));
    const spot = countdown && item.querySelector(SPOT);
    if (!countdown || !spot) {
      existing?.remove();
      continue;
    }
    const line = existing ?? document.createElement('p');
    line.className = COUNTDOWN_CLASS;
    if (line.textContent !== countdown.text) line.textContent = countdown.text;
    if (line.title !== countdown.hint) {
      line.title = countdown.hint;
      line.setAttribute('aria-description', countdown.hint);
    }
    if (line.parentElement !== spot) spot.append(line);
  }
}

/** Adds, updates or removes the counts (#506) on every base ship shown now. */
function applyCounts(root: ParentNode, options: UpgradeDialogOptions): void {
  const items = [...root.querySelectorAll(MODAL)].flatMap((modal) =>
    [...modal.querySelectorAll(FROM)].flatMap((side) => [...side.querySelectorAll(ITEM)]),
  );
  for (const item of items) {
    const existing = item.querySelector<HTMLElement>(`.${COUNTS_CLASS}`);
    const counts = options.countsOf?.(targetOf(item));
    const thumb = counts && item.querySelector(THUMB);
    if (!counts || !thumb) {
      existing?.remove();
      continue;
    }
    const line = existing ?? document.createElement('p');
    line.className = COUNTS_CLASS;
    if (line.textContent !== counts.text) line.textContent = counts.text;
    line.title = counts.hint;
    line.setAttribute('aria-description', counts.hint);
    if (line.parentElement !== thumb) thumb.append(line);
  }
}

/**
 * Watches the page for RSI's ship upgrade dialog and keeps the labels of its ships; `update`
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
    if (openedAt === undefined) {
      openedAt = Date.now();
      options.onOpen?.();
    }
    const sides = [...modal.querySelectorAll(SELECTORS)];
    if (!sides.length) {
      if (Date.now() - openedAt > MISMATCH_AFTER_MS) mismatch('no lists of ships');
      return;
    }
    const items = sides.flatMap((side) => [...side.querySelectorAll(ITEM)]);
    if (items.length && items.every((item) => !targetOf(item).id && !targetOf(item).name)) {
      mismatch('no ship id or name');
    } else if (items.length && !items.some((item) => item.querySelector(SPOT))) {
      mismatch('no place for the label');
    } else if (
      options.countsOf &&
      modal.querySelector(`${FROM} ${ITEM}`) &&
      !modal.querySelector(`${FROM} ${ITEM} ${THUMB}`)
    ) {
      mismatch('no place for the counts');
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
  // The countdowns (#570) of an open dialog keep running.
  const ticker = options.countdownOf
    ? setInterval(() => root.querySelector(`.${COUNTDOWN_CLASS}`) && schedule(), TICK_MS)
    : undefined;
  schedule();
  return {
    update: schedule,
    stop: () => {
      observer.disconnect();
      clearInterval(timer);
      clearInterval(ticker);
      if (frame) cancelAnimationFrame(frame);
      for (const label of root.querySelectorAll(
        `.${LABEL_CLASS}, .${COUNTS_CLASS}, .${COUNTDOWN_CLASS}`,
      )) {
        label.remove();
      }
    },
  };
}

/*
 * The boxes of the sidebar below RSI's page navigation (see `HangarSidebar.vue`) and their order,
 * which the user changes by drag and drop or with the arrow keys and which is kept in the settings,
 * like the boxes collapsed to their title.
 * Boxes that are hidden at the moment (no selection, "Hide melt value") keep their place.
 */

/** The boxes, in their default order. */
export const SIDEBAR_BOXES = ['storeCredit', 'summary', 'selection'] as const;
export type SidebarBox = (typeof SIDEBAR_BOXES)[number];

const isSidebarBox = (value: unknown): value is SidebarBox =>
  SIDEBAR_BOXES.includes(value as SidebarBox);

/** The known boxes of a stored list, each once (e.g. the collapsed boxes). */
export const sidebarBoxesOf = (stored: unknown): SidebarBox[] => [
  ...new Set(Array.isArray(stored) ? stored.filter(isSidebarBox) : []),
];

/**
 * A complete order from a stored one: unknown and repeated boxes are dropped, missing ones (e.g.
 * new in an update) are added where the default order has them – after the box before them there.
 */
export function normalizeSidebarOrder(stored: unknown): SidebarBox[] {
  const order = sidebarBoxesOf(stored);
  SIDEBAR_BOXES.forEach((box, index) => {
    if (order.includes(box)) return;
    const before = SIDEBAR_BOXES.slice(0, index).findLast((other) => order.includes(other));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, box);
  });
  return order;
}

/** `order` with `box` placed right before or after `target`. */
export function placeBox(
  order: readonly SidebarBox[],
  box: SidebarBox,
  target: SidebarBox,
  after: boolean,
): SidebarBox[] {
  if (box === target) return [...order];
  const rest = order.filter((other) => other !== box);
  rest.splice(rest.indexOf(target) + (after ? 1 : 0), 0, box);
  return rest;
}

/**
 * `order` with the dragged `box` placed by the pointer at `y`: before the first other box whose
 * middle is below it, otherwise after the last one. The pointer counts, not the dragged box's
 * middle: the box stays within the sidebar, so a box higher than the one above it could never get
 * its middle past that one's middle. `others` are the shown boxes but the dragged one, top to
 * bottom, measured as if the dragged box weren't there.
 */
export function placeAt(
  order: readonly SidebarBox[],
  box: SidebarBox,
  others: readonly { box: SidebarBox; middle: number }[],
  y: number,
): SidebarBox[] {
  const below = others.find((other) => y < other.middle);
  const last = others.at(-1);
  if (below) return placeBox(order, box, below.box, false);
  return last ? placeBox(order, box, last.box, true) : [...order];
}

/**
 * `order` with `box` moved one place up (`-1`) or down (`1`) among the boxes `shown`; unchanged at
 * the top or bottom.
 */
export function moveBox(
  order: readonly SidebarBox[],
  box: SidebarBox,
  step: -1 | 1,
  shown: readonly SidebarBox[],
): SidebarBox[] {
  const visible = order.filter((other) => shown.includes(other));
  const target = visible[visible.indexOf(box) + step];
  return target ? placeBox(order, box, target, step > 0) : [...order];
}

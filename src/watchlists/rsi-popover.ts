/*
 * Where the choice of watchlists of a button on RSI's pages opens (#632): over the button, so it
 * grows out of it – downwards from the button's top, or upwards from its bottom (the ship upgrade
 * dialog's bar sits at the bottom of the window) – and aligned to the button's right edge, so it
 * never covers what is right of the button, e.g. RSI's "Add To Cart". It flips to the other side
 * when there is no room, and stays inside the window.
 */

export type PopoverSide = 'below' | 'above';

interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Distance kept to the window's edges. */
const MARGIN = 8;

export function popoverPlacement(
  anchor: Rect,
  size: { width: number; height: number },
  view: { width: number; height: number },
  side: PopoverSide,
): { left: number; top: number; side: PopoverSide } {
  const fitsBelow = anchor.top + size.height <= view.height - MARGIN;
  const fitsAbove = anchor.bottom - size.height >= MARGIN;
  const chosen: PopoverSide =
    side === 'below'
      ? fitsBelow || !fitsAbove
        ? 'below'
        : 'above'
      : fitsAbove || !fitsBelow
        ? 'above'
        : 'below';
  const top = chosen === 'below' ? anchor.top : anchor.bottom - size.height;
  const clamp = (value: number, max: number) => Math.max(MARGIN, Math.min(value, max - MARGIN));
  return {
    left: clamp(anchor.right - size.width, view.width - size.width),
    top: clamp(top, view.height - size.height),
    side: chosen,
  };
}

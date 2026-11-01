/**
 * Whether a click on a link is a plain left click. Clicks with modifier keys or other buttons
 * keep the browser's default behavior (e.g. opening the link in a new tab).
 */
export function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

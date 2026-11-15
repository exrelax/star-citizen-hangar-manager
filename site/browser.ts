/*
 * The store button of the visitor's browser is the call to action: "Add to Firefox" in Firefox
 * and the browsers built on it (Waterfox, LibreWolf, Floorp, Zen, …), "Add to Chrome" in Chrome
 * and the browsers built on Chromium (Edge, Opera, Vivaldi, Brave, …), which install from the
 * Chrome Web Store. Any other browser keeps "Add to Chrome", the page's default without script.
 *
 * `browserFamily` runs as an inline script in the page's head (see vite.config.ts), before the
 * page is drawn, so the highlight never jumps: it sets `data-browser` on `<html>`, and the styles
 * pick the button by it. It is a plain function with no imports, since its source is inlined.
 */

export type BrowserFamily = 'firefox' | 'chromium' | 'other';

/**
 * The family of a browser, by its user agent and, where offered, its brands (Chromium only).
 * Firefox and its forks name it in the user agent; Firefox for iOS ("FxiOS") is Safari inside.
 * No comments inside: its source becomes one line.
 */
export function browserFamily(
  userAgent: string,
  brands?: readonly { brand: string }[],
): BrowserFamily {
  if (/\bFirefox\//.test(userAgent)) return 'firefox';
  if (
    brands?.some(({ brand }) => brand === 'Chromium') ||
    /\b(?:Chrome|Chromium)\//.test(userAgent)
  ) {
    return 'chromium';
  }
  return 'other';
}

/** The inline script for the page's head, on one line. */
export const browserScript = (): string =>
  `<script>try{document.documentElement.dataset.browser=(${browserFamily.toString().replace(/\s+/g, ' ')})(navigator.userAgent,navigator.userAgentData&&navigator.userAgentData.brands)}catch(e){}</script>`;

/** Where the summary box was dropped, in viewport pixels; unset: below RSI's page navigation. */
export interface SummaryPosition {
  left: number;
  top: number;
}

/**
 * Kept in the extension's session storage only: after the browser session the box is back at its
 * place. Content scripts may use it once the background allowed them (see `background.ts`).
 */
export const summaryPosition = storage.defineItem<SummaryPosition | null>(
  'session:summary.position',
  { fallback: null },
);

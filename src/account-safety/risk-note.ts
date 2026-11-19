/*
 * RSI's Terms of Service and the account (#330): CIG's Terms of Service forbid bots, and it isn't
 * clear whether the smart updates could count as one. The note is in the README, on the website
 * and in the settings (under the version in "About"). Once in the sidebar until "Got it" only
 * with `FEATURES.tosSidebarNote`.
 */

/** RSI's Terms of Service. */
export const RSI_TOS_URL = 'https://robertsspaceindustries.com/tos';

/**
 * The sidebar's note was confirmed with "Got it". Synced: whoever read it needn't confirm it in
 * every browser.
 */
export const riskNoteSeenItem = storage.defineItem<boolean>('sync:accountSafety.riskNoteSeen', {
  fallback: false,
});

/** The demo's own "Got it" (#416): closing the note in the demo leaves the real one as it is. */
export const demoRiskNoteSeenItem = storage.defineItem<boolean>('local:demo.riskNoteSeen', {
  fallback: false,
});

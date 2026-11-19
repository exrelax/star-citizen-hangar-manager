/*
 * The risk for the RSI account (#330): the Hangar Manager isn't approved by RSI, and RSI's Terms
 * of Service forbid tools and automated access it hasn't approved. The note is in the README, on
 * the website and in the settings ("About"), and shows once in the sidebar until "Got it".
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

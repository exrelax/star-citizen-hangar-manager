/*
 * The demo's random key (#178): which generated demo hangar, buy back and orders show. Created on
 * first use by the manager and kept only in this browser; read by RSI's ship upgrade dialog for
 * its demo counts (#578).
 */
export const demoKeyItem = storage.defineItem<string | null>('local:demo.key', { fallback: null });

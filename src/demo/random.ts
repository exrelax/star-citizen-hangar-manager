/*
 * Random numbers for the demo, fixed by the demo key: the same key gives the same demo hangar on
 * every visit, so screenshots can be repeated, and a new key a new one (#175).
 */

/** cyrb53: a fast 53-bit string hash with a good spread. */
export function hash(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** A number in [0, 1), fixed for `text`. */
export const fraction = (text: string): number => hash(text) / 2 ** 53;

/** Random choices fixed by a key, each named by a label. */
export function createRandom(key: string) {
  const at = (label: string) => fraction(`${key}:${label}`);
  return {
    /** A number in [0, 1). */
    at,
    /** A whole number from `min` to `max`, both included. */
    int: (label: string, min: number, max: number) => min + Math.floor(at(label) * (max - min + 1)),
    /** Whether a chance of `share` (0 to 1) came up. */
    chance: (label: string, share: number) => at(label) < share,
    /** One entry of a list; none of an empty one. */
    pick: <T>(label: string, list: readonly T[]): T | undefined =>
      list.length ? list[Math.floor(at(label) * list.length)] : undefined,
    /** The list in a random but fixed order. */
    shuffle: <T>(label: string, list: readonly T[], idOf: (entry: T) => string | number) =>
      [...list].sort((a, b) => at(`${label}:${idOf(a)}`) - at(`${label}:${idOf(b)}`)),
  };
}

export type DemoRandom = ReturnType<typeof createRandom>;

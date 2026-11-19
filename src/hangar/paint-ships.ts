import { i18n } from '@/i18n';
import { inject, shallowRef, type InjectionKey, type Ref } from 'vue';
import type { RefinementOption } from './filters';

/*
 * Paints by the ships they are for (#336), for the refinement of the filter "Paints" (#419): the
 * paints for a ship the user owns, or for a ship they don't own.
 *
 * - A paint names its ship before its own name: "Sabre - Ashcloud Paint", in a pledge titled
 *   "Paints - Sabre - Ashcloud Paint". Often that is a series or a family of ships ("Sabre",
 *   "Constellation Series", "Spirit"), so a paint fits every ship whose name contains those words
 *   in that order: "Sabre" fits the Sabre Comet, "Spirit" the C1 Spirit, "Constellation Series"
 *   every Constellation. The word "Series" is left out.
 * - A ship is owned when the hangar has it: standalone, in a package or as the current ship of a
 *   pledge with applied upgrades (RSI lists its current ships). CCUs that weren't applied don't
 *   count, and in the Buy Back, too, the ships owned are those of the hangar.
 * - A model code names the models after it, too: "C8 Pisces" fits the C8R and C8X Pisces, "100
 *   Series" the 100i. Only words with a digit match as a beginning, so "Mk V" stays apart from
 *   "Mk VI".
 * - A paint without its ship before its name ("MTC Citizens for Prosperity Liberation Livery")
 *   fits an owned ship whose name is in its title.
 * - A pledge with several paints is for owned ships as soon as one of them fits an owned ship. A
 *   paint that fits no owned ship this way counts as one for ships not owned.
 */

const words = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && word !== 'series');

/** The words of the ship a paint is for, from its title; none if it doesn't name one. */
export function paintShipWords(title: string): string[] | undefined {
  const parts = title
    .replace(/^\s*paints?\s+-\s+/i, '')
    .split(/\s+-\s+/)
    .map((part) => part.trim());
  if (parts.length < 2 || !parts[0]) return undefined;
  const ship = words(parts[0]);
  return ship.length ? ship : undefined;
}

/** A word of a paint's ship fits a word of a ship's name: the same, or a model code's beginning. */
const fitsWord = (part: string, word: string) =>
  part === word || (/\d/.test(part) && word.startsWith(part));

/** Whether `part` appears in `whole` as consecutive words. */
function containsWords(
  whole: readonly string[],
  part: readonly string[],
  fits = fitsWord,
): boolean {
  for (let start = 0; start + part.length <= whole.length; start++) {
    if (part.every((word, index) => fits(word, whole[start + index]!))) return true;
  }
  return false;
}

/** The owned ships, by their names, for `isForOwnedShip`. */
export type OwnedShips = readonly (readonly string[])[];

/** The owned ships from the names of the hangar's ships (duplicates are fine). */
export const ownedShips = (names: Iterable<string>): OwnedShips =>
  [...new Set(names)].map(words).filter((ship) => ship.length);

/** Whether one of the paints (by their titles) is for an owned ship. */
export function isForOwnedShip(titles: readonly string[], owned: OwnedShips): boolean {
  return titles.some((title) => {
    const ship = paintShipWords(title);
    if (ship) return owned.some((name) => containsWords(name, ship));
    // No ship before the name: an owned ship named in the title, word for word.
    const all = words(title);
    return owned.some((name) => containsWords(all, name, (a, b) => a === b));
  });
}

/** The hangar's ships, provided by the manager view (see `App.vue`) for both lists. */
export const OWNED_SHIPS: InjectionKey<Readonly<Ref<OwnedShips>>> = Symbol('ownedShips');

export function useProvidedOwnedShips(): Readonly<Ref<OwnedShips>> {
  return inject(OWNED_SHIPS, shallowRef([]));
}

/**
 * The refinement of the filter "Paints" (#419): all paints, those for owned ships, those for ships
 * not owned. `titlesOf`: the titles of an entry's paints, its own title among them.
 */
export function paintRefinement<T>(
  owned: OwnedShips,
  titlesOf: (entry: T) => readonly string[],
): RefinementOption<T>[] {
  const forOwned = (entry: T) => isForOwnedShip(titlesOf(entry), owned);
  return [
    { id: 'all', label: i18n.t('filter.paintShips.all') },
    {
      id: 'owned',
      label: i18n.t('filter.paintShips.owned'),
      short: i18n.t('filter.paintShips.ownedShort'),
      matches: forOwned,
    },
    {
      id: 'notOwned',
      label: i18n.t('filter.paintShips.notOwned'),
      short: i18n.t('filter.paintShips.notOwnedShort'),
      matches: (entry) => !forOwned(entry),
    },
  ];
}

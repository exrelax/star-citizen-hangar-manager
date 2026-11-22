/*
 * Ship packs at a glance (#515): a pledge with two ships or more – the option "Ship packs" of the
 * filter "Ships" (#514) – shows its ships in the list: their images fanned out like cards, their
 * count next to the name, all of them as its title (shortened, with a tooltip that lists them), and
 * a tile per ship when expanded. Single ships look as before.
 */

/** A ship of a pack, with its image if one is known. */
export interface PackShip {
  name: string;
  image?: string;
}

/** The ships of a pack, each name once with its count, in the order of their first appearance. */
export function packNames(ships: readonly PackShip[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const ship of ships) counts.set(ship.name, (counts.get(ship.name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count }));
}

/** The title of a pack: its ships, "2× Ursa Medivac, C8R Pisces". */
export const packTitle = (ships: readonly PackShip[]): string =>
  packNames(ships)
    .map(({ name, count }) => (count > 1 ? `${count}× ${name}` : name))
    .join(', ');

/**
 * The cards of the fanned images, front first: the first ship and up to two more, each name once.
 * `fan` is the card's turn: the front one in the middle (or left of the second), the others left
 * and right of it.
 */
export function packCards(ships: readonly PackShip[]): (PackShip & { fan: number })[] {
  const unique = packNames(ships).map(({ name }) => ships.find((ship) => ship.name === name)!);
  const cards = unique.slice(0, 3);
  // Two cards side by side, three around the front one.
  const fans = cards.length === 2 ? [-0.5, 0.5] : [0, 1, -1];
  return cards.map((ship, index) => ({ ...ship, fan: fans[index]! }));
}

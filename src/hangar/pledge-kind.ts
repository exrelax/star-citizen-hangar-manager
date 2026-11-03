import type { IconName } from '@/icons/icon-names';
import type { PledgeView } from './pledge-view';

/** What kind of pledge it is, shown prominently in the dialogs for exchanging and gifting. */
export type PledgeKind =
  'upgradedShip' | 'ship' | 'ships' | 'gamePackage' | 'ccu' | 'paint' | 'reward' | 'other';

export function pledgeKind(pledge: PledgeView): PledgeKind {
  if (pledge.isCcu) return 'ccu';
  if (pledge.isUpgraded) return 'upgradedShip';
  if (pledge.hasGameAccess) return 'gamePackage';
  if (pledge.isPaint) return 'paint';
  const ships = pledge.ships.length + (pledge.titleShip ? 1 : 0);
  if (ships > 1) return 'ships';
  if (ships === 1) return 'ship';
  return pledge.reward ? 'reward' : 'other';
}

/**
 * The icon of a row's primary kind (see row.css), for hangar and buy back pledges: CCU, paint,
 * game package (RSI's category), ship (also upgraded ships and $0 ships), reward – and the game
 * access of anything else that contains the game. Others get none.
 */
export function kindIcon(entry: {
  isCcu: boolean;
  isPaint: boolean;
  isGamePackage: boolean;
  isReward: boolean;
  hasGameAccess: boolean;
  ships: readonly unknown[];
  titleShip?: unknown;
}): IconName | undefined {
  if (entry.isCcu) return 'square-up-right';
  if (entry.isPaint) return 'palette';
  // A game package contains a ship, but the game is what it is about.
  if (entry.isGamePackage) return 'lock-open';
  // A ship pledge stays a ship, even with the game in it (e.g. "Nomad - LTI").
  if (entry.titleShip || entry.ships.length) return 'shuttle-space';
  if (entry.isReward) return 'award';
  if (entry.hasGameAccess) return 'lock-open';
  return undefined;
}

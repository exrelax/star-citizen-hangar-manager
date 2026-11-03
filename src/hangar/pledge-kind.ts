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

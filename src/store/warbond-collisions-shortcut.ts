import { i18n } from '@/i18n';
import type { ListShortcutDefinition } from '@/hangar/list-shortcut';
import type { WarbondOffer } from './warbond';

/** The id of the List Shortcut of a warbond offer's colliding CCUs, one per warbond ship. */
export const warbondCollisionsShortcutId = (offer: Pick<WarbondOffer, 'target'>) =>
  `warbondCollisions:${offer.target.ship.id}`;

/**
 * The List Shortcut of a warbond CCU (#429, see `list-shortcut.ts`): My Hangar with exactly the own
 * CCUs that can't be chained with it – those whose price span overlaps the warbond CCU's
 * (`ownedCcusInRange`), as its table "Your CCUs between" lists them, every pledge of each group.
 * In the demo the offer's `owned` comes from the demo hangar, so it shows the demo's CCUs only.
 */
export const warbondCollisionsShortcut = (
  offer: Pick<WarbondOffer, 'target' | 'owned'>,
): ListShortcutDefinition<'hangar'> => {
  const ship = offer.target.ship.name;
  return {
    list: 'hangar',
    id: warbondCollisionsShortcutId(offer),
    title: () => i18n.t('listShortcut.warbondCollisions', [ship]),
    icon: 'shuttle-space',
    ids: offer.owned.flatMap((ccu) => ccu.ids),
    emptyText: () => i18n.t('listShortcut.warbondCollisionsEmpty', [ship]),
  };
};

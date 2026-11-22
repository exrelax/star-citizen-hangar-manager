import { i18n } from '@/i18n';
import type { ListShortcutDefinition } from '@/hangar/list-shortcut';
import type { Ref } from 'vue';
import RebuyShortcutExtra from './components/RebuyShortcutExtra.vue';
import { isRebuyable } from './rebuy-summary';
import type { Rebuy } from './rebuyable';

/** The id of the List Shortcut "Melt and rebuy" (#530). */
export const MELT_REBUY_SHORTCUT_ID = 'meltRebuy';

/**
 * The List Shortcut "Melt and rebuy" (#530, see `list-shortcut.ts`): the rebuyable pledges of My
 * Hangar, by the results the manager provides, with the store credit they free and the button to
 * put them on a watchlist in its bar.
 */
export const meltRebuyShortcut = (
  rebuys: Readonly<Ref<ReadonlyMap<number, Rebuy>>>,
): ListShortcutDefinition<'hangar'> => ({
  list: 'hangar',
  id: MELT_REBUY_SHORTCUT_ID,
  title: () => i18n.t('meltRebuy.shortcutTitle'),
  icon: 'recycle',
  matches: (pledge) => isRebuyable(rebuys.value, pledge.id),
  emptyText: () => i18n.t('listShortcut.meltRebuyEmpty'),
  extra: RebuyShortcutExtra,
});

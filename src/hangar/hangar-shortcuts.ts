import { i18n } from '@/i18n';
import { paintRebuys } from '@/store/paint-consultant/use-paint-consultant';
import type { ListShortcutDefinition } from './list-shortcut';
import { meltReadyIds } from './use-melt-marks';

/*
 * The List Shortcuts of My Hangar opened from the sidebar (#428, see `list-shortcut.ts`): "Show"
 * of the notification about marked pledges that can be melted now (#144) and "Show these paints"
 * of the Paint Discount Consultant's box (#146). "Melt and rebuy" (#530) is in
 * `melt-rebuy/rebuy-shortcut.ts`.
 */

/** The marked pledges that can be melted now. */
export const MELT_READY_SHORTCUT: ListShortcutDefinition<'hangar'> = {
  list: 'hangar',
  id: 'meltReady',
  title: () => i18n.t('listShortcut.meltReady'),
  icon: 'recycle',
  matches: (pledge) => meltReadyIds.value.has(pledge.id),
  emptyText: () => i18n.t('listShortcut.meltReadyEmpty'),
};

/** The paints the Paint Discount Consultant's plan buys again. */
export const PAINT_REBUY_SHORTCUT: ListShortcutDefinition<'hangar'> = {
  list: 'hangar',
  id: 'paintRebuy',
  title: () => i18n.t('consultant.boxPaints'),
  icon: 'palette',
  matches: (pledge) => paintRebuys.value.has(pledge.id),
  emptyText: () => i18n.t('listShortcut.paintRebuyEmpty'),
};

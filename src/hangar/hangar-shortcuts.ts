import { i18n } from '@/i18n';
import { paintRebuys } from '@/store/paint-consultant/use-paint-consultant';
import type { ListShortcutDefinition } from './list-shortcut';
import { meltReadyIds } from './use-melt-marks';

/*
 * The List Shortcuts of My Hangar opened from the sidebar (#428, see `list-shortcut.ts`): "Show"
 * of the notification about marked pledges that can be melted now (#144) and "Show these paints"
 * of the Paint Discount Consultant's box (#146) and its new plan (#430). "Melt and rebuy" (#530)
 * is in `melt-rebuy/rebuy-shortcut.ts`.
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

/**
 * The paints the Paint Discount Consultant's plan would optimize: the ones it buys again, and old
 * ones bought again already, left to melt. Opened by "Show these paints" of its sidebar box and of
 * the consultant's new plan (#430), so both show the same paints.
 */
export const PAINT_REBUY_SHORTCUT: ListShortcutDefinition<'hangar'> = {
  list: 'hangar',
  id: 'paintRebuy',
  title: () => i18n.t('listShortcut.paintsToOptimize'),
  icon: 'palette',
  matches: (pledge) => paintRebuys.value.has(pledge.id),
  emptyText: () => i18n.t('listShortcut.paintRebuyEmpty'),
};

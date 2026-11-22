import type { ListShortcutDefinition } from '@/hangar/list-shortcut';
import { i18n } from '@/i18n';
import type { BaseShipGroup } from './base-ship-list';

/*
 * The List Shortcuts of the CCU Consultant (#563, see `list-shortcut.ts`): My Hangar with the CCUs
 * of a group or of one base ship, and the Buy Back with the ships and CCUs to a base ship.
 */

/** A group of the consultant's tabs: those of the base ship coverage and "Discount at risk". */
export type ConsultantGroup = BaseShipGroup | 'atRisk';

const groupLabel = (group: ConsultantGroup) =>
  group === 'atRisk'
    ? i18n.t('ccuConsultant.atRisk.title')
    : i18n.t(`ccuConsultant.standing.${group}`);

/**
 * My Hangar with the CCUs of a group: "Show N CCUs in My Hangar". `deep`: the deep view's "Too few
 * ways" instead of "Without base ship" (#563).
 */
export const ccuGroupShortcut = (
  group: ConsultantGroup,
  ids: Iterable<number>,
  deep = false,
): ListShortcutDefinition<'hangar'> => ({
  list: 'hangar',
  id: deep && group === 'missing' ? 'ccuConsultant:tooFew' : `ccuConsultant:${group}`,
  title: () =>
    i18n.t('listShortcut.ccuGroup', [
      deep && group === 'missing' ? i18n.t('ccuConsultant.deep.tab') : groupLabel(group),
    ]),
  icon: 'link',
  ids,
  emptyText: () => i18n.t('listShortcut.ccuEmpty'),
});

/** My Hangar with the CCUs from one base ship: a card of the simple view. */
export const ccuBaseShipShortcut = (
  key: string,
  name: string,
  ids: Iterable<number>,
): ListShortcutDefinition<'hangar'> => ({
  list: 'hangar',
  id: `ccuConsultant:from:${key}`,
  title: () => i18n.t('listShortcut.ccuBaseShip', [name]),
  icon: 'link',
  ids,
  emptyText: () => i18n.t('listShortcut.ccuEmpty'),
});

/** The Buy Back with the ships and CCUs to one base ship: "Buy Back" of a card. */
export const ccuBuybackShortcut = (
  key: string,
  name: string,
  ids: Iterable<number>,
): ListShortcutDefinition<'buyback'> => ({
  list: 'buyback',
  id: `ccuConsultant:to:${key}`,
  title: () => i18n.t('listShortcut.ccuBuyback', [name]),
  icon: 'clock-rotate-left',
  ids,
  emptyText: () => i18n.t('listShortcut.ccuBuybackEmpty'),
});

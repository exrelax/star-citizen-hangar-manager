import { i18n, type Locale } from '@/i18n';
import { rsiUrl } from '@/shared/rsi-api';
import type { Ship } from '@/ships/ships';
import { listDate, type AlwaysAvailableList } from './always-available';
import { standingOf } from './base-ship-list';
import type { CcuCoverage } from './coverage';

/*
 * The CCU Consultant's labels of a CCU, for its single row and for a group of CCUs (#487): "Base
 * always available" (#112) with its tooltip naming the source and date of the list, and "Base ship
 * missing" (#114) with its note and the ship's page in the Pledge Store.
 */

/** The tooltip of "Base always available", if the CCU's base ship is on the list. */
export function alwaysAvailableHintOf(
  coverage: CcuCoverage | undefined,
  list: AlwaysAvailableList | undefined,
  locale: Locale,
): string | undefined {
  const ship = coverage?.baseShip;
  if (!list || ship?.id === undefined || !list.has(ship.id)) return undefined;
  const date = listDate(list.changedAt, locale);
  return date
    ? i18n.t('ccuCoverage.alwaysAvailableHint', [ship.name, list.source.name, date])
    : i18n.t('ccuCoverage.alwaysAvailableHintUndated', [ship.name, list.source.name]);
}

/**
 * "Base ship missing" of a CCU: its note and the ship's page, if it has no base ship. None for a
 * base ship leaving the Pledge Store that can still be had now (#454, `leaving`): its warning
 * (#289) tells it, with the ship's date.
 */
export function baseMissingOf(
  coverage: CcuCoverage | undefined,
  list: AlwaysAvailableList | undefined,
  ships: readonly Ship[],
  leaving?: ReadonlyMap<number, unknown>,
): { note: string; link?: string; linkLabel?: string } | undefined {
  if (!coverage || standingOf(coverage, list) !== 'missing') return undefined;
  if (coverage.baseShip?.id !== undefined && leaving?.has(coverage.baseShip.id)) return undefined;
  const id = coverage.baseShip?.id;
  const ship = id !== undefined ? ships.find((entry) => entry.id === id) : undefined;
  const name = ship?.name ?? coverage.baseShip?.name ?? i18n.t('ccuCoverage.baseShip');
  return {
    note: i18n.t(list ? 'ccuCoverage.missingNote' : 'ccuCoverage.missingNoteAll', [name]),
    ...(ship?.link && {
      link: rsiUrl(ship.link),
      linkLabel: i18n.t('ccuCoverage.missingLink', [ship.name]),
    }),
  };
}

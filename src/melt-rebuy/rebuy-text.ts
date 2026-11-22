import { formatUsd } from '@/hangar/discount-format';
import { insuranceLabel } from '@/hangar/insurance';
import { i18n, locale } from '@/i18n';
import type { Rebuy, RebuyReason } from './rebuyable';

/*
 * The texts of Melt and Rebuy (#528) for the UI (#530): a short text per reason why a pledge
 * can't be rebought without loss ("Giftable", "Discount of $40", "Price increase expected: Perseus")
 * and the label's tooltip. In the active locale.
 */

const date = (iso: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

/** The short text of a reason. */
export function rebuyReasonText(reason: RebuyReason): string {
  const usd = (value: number) => formatUsd(value, locale.value);
  switch (reason.code) {
    case 'refundPeriod':
      return i18n.t('meltRebuy.reason.refundPeriod', [date(reason.until)]);
    case 'discount':
    case 'paintVolumeDiscount':
      return i18n.t(`meltRebuy.reason.${reason.code}`, [usd(reason.amount)]);
    case 'insurance':
      return i18n.t('meltRebuy.reason.insurance', [insuranceLabel(reason.insurance)]);
    case 'priceIncrease':
      return i18n.t(
        reason.confirmed
          ? 'meltRebuy.reason.priceIncrease'
          : 'meltRebuy.reason.priceIncreaseExpected',
        [reason.ship],
      );
    case 'removal':
    case 'notAlwaysAvailable':
      return i18n.t(`meltRebuy.reason.${reason.code}`, [reason.ship]);
    case 'unknown':
      return i18n.t(`meltRebuy.reason.unknown.${reason.missing}`);
    default:
      return i18n.t(`meltRebuy.reason.${reason.code}`);
  }
}

/** The tooltip of the label "Rebuyable": the freed store credit and the rebuy price. */
export function rebuyLabelHint(rebuy: Pick<Rebuy, 'freedCredit' | 'rebuyPrice'>): string {
  const usd = (value: number) => formatUsd(value, locale.value);
  return i18n.t('meltRebuy.labelHint', [usd(rebuy.freedCredit), usd(rebuy.rebuyPrice ?? 0)]);
}

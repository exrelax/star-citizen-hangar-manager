import { formatUsd } from '@/hangar/discount-format';
import { insuranceLabel } from '@/hangar/insurance';
import { i18n, locale } from '@/i18n';
import type { Rebuy, RebuyReason } from './rebuyable';
import type { RebuySummary } from './rebuy-summary';

/*
 * The texts of Melt and Rebuy (#528) for the UI (#530): a short text per reason why a pledge
 * can't be rebought without loss ("Giftable", "Discount of $40", "Price increase expected: Perseus")
 * and the label's tooltip. In the active locale.
 */

const date = (iso: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

/** The short text of a reason without amounts, for "Hide melt value" (#530). */
export function rebuyReasonPlainText(reason: RebuyReason): string {
  if (reason.code === 'discount') return i18n.t('meltRebuy.reasonDiscountPlain');
  return rebuyReasonText(reason);
}

/** The short text of a reason. */
export function rebuyReasonText(reason: RebuyReason): string {
  const usd = (value: number) => formatUsd(value, locale.value);
  switch (reason.code) {
    case 'refundPeriod':
      return i18n.t('meltRebuy.reason.refundPeriod', [date(reason.until)]);
    case 'discount':
      return i18n.t('meltRebuy.reason.discount', [usd(reason.amount)]);
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

/**
 * The tooltip of the label "Rebuyable": the freed store credit and the rebuy price; with
 * `hideValues` ("Hide melt value") what the label means, without amounts.
 */
export function rebuyLabelHint(
  rebuy: Pick<Rebuy, 'freedCredit' | 'rebuyPrice' | 'volumeDiscount'>,
  options?: { hideValues?: boolean },
): string {
  const usd = (value: number) => formatUsd(value, locale.value);
  const hint = options?.hideValues
    ? i18n.t('meltRebuy.labelHintPlain')
    : i18n.t('meltRebuy.labelHint', [usd(rebuy.freedCredit), usd(rebuy.rebuyPrice ?? 0)]);
  // A paint bought at a volume discount gets it again only with enough paints in one cart (#593).
  const volume = rebuy.volumeDiscount;
  return volume
    ? `${hint} ${i18n.t('meltRebuy.volumeHint', [volume.percent, volume.paints])}`
    : hint;
}

/**
 * The note on rebuyable paints bought at a volume discount among `rebuys` (#593): how many, the
 * highest tier and the paints one cart needs for it; none without such paints.
 */
export function rebuyVolumeNote(rebuys: Iterable<Rebuy | undefined>): string | undefined {
  let count = 0;
  let percent = 0;
  let paints = 0;
  for (const rebuy of rebuys) {
    const volume = rebuy?.rebuyable ? rebuy.volumeDiscount : undefined;
    if (!volume) continue;
    count += 1;
    if (volume.percent > percent) ({ percent, paints } = volume);
  }
  return count ? i18n.n('meltRebuy.volumeNote', count, [count, percent, paints]) : undefined;
}

/**
 * What several rebuyable pledges free and cost together (#530), e.g. a group's label or the
 * "Selected" box; with `hideValues` what the label means, without amounts.
 */
export function rebuyGroupHint(summary: RebuySummary, options?: { hideValues?: boolean }): string {
  if (options?.hideValues) return i18n.t('meltRebuy.labelHintPlain');
  const usd = (value: number) => formatUsd(value, locale.value);
  return i18n.n('meltRebuy.groupHint', summary.count, [
    summary.count,
    usd(summary.freedCredit),
    usd(summary.rebuyPrice),
  ]);
}

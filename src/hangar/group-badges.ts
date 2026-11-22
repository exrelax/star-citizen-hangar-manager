import type { BuybackView } from '@/buyback/buyback-view';
import type { AlwaysAvailableList } from '@/ccu-consultant/always-available';
import { alwaysAvailableHintOf, baseMissingOf } from '@/ccu-consultant/ccu-labels';
import type { CcuCoverage } from '@/ccu-consultant/coverage';
import { REFUND_DAYS, REFUND_URGENT_DAYS } from '@/config';
import { i18n, type Locale } from '@/i18n';
import { refundWindow } from '@/orders/refund';
import type { Ship } from '@/ships/ships';
import type { IconName } from '@/icons/icon-names';
import type { GroupExtra, GroupShare, ItemGroup } from './grouping';
import { insuranceLabel, type Insurance } from './insurance';
import { kindIcon } from './pledge-kind';
import { formatTimeLeft } from './melt-marks';
import type { MarkedPledge } from './use-melt-marks';
import type { PledgeView } from './pledge-view';
import { isRewardTitle } from './rewards';
import type { Rebuy } from '@/melt-rebuy/rebuyable';
import { rebuySummary } from '@/melt-rebuy/rebuy-summary';
import { rebuyGroupHint } from '@/melt-rebuy/rebuy-text';

/*
 * What the row of a group shows besides its sums (#448): the badges of its items by the same rule
 * as a single row's – all of them, some of them ("Some gift") or none (the off state) – and a note
 * on the extras that differ ("some with gear, different insurance"). An insurance shows while all
 * items have the same one; otherwise the note tells it.
 *
 * From the items' own labels too (#487): "Base ship missing" and "Base always available" of the CCU
 * Consultant, with the single row's tooltip; the refund countdown of the item with the least time
 * left, with how many items can still be refunded. "Rebuyable" of Melt and Rebuy (#530) for all or
 * some items, with what the rebuyable ones free and cost together.
 */

/** What the labels taken from the items need besides the items (My Hangar). */
export interface GroupBadgeContext {
  coverageOf: (id: number) => CcuCoverage | undefined;
  alwaysAvailable?: AlwaysAvailableList;
  ships: readonly Ship[];
  /** The ships leaving the Pledge Store that can still be had now (#454), by ship id. */
  leaving?: ReadonlyMap<number, unknown>;
  /** Today (local ISO date), for the refund countdown. */
  today: string;
  locale: Locale;
  /** The pledges marked to melt (#97), and now (ms), for the melt label of a group (#552). */
  marks?: ReadonlyMap<number, MarkedPledge>;
  now?: number;
  /** Melt and Rebuy (#530) while its label shows; `hideValues`: without amounts. */
  rebuy?: { entries: ReadonlyMap<number, Rebuy>; hideValues: boolean };
}

export interface GroupBadge {
  key: string;
  text: string;
  /** Classes of the single row's badge (row.css), e.g. `is-insurance is-lti`. */
  className?: string;
  /** None of the items has it: struck through, as a single row's off badge. */
  off?: boolean;
  hint?: string;
  /** An icon before the text, as the single row's badge has it, e.g. the melt mark's. */
  icon?: IconName;
  /** A small count at its top right corner, as a notification badge (#552). */
  count?: string;
}

const shareOf = <T>(items: readonly T[], has: (item: T) => boolean): GroupShare => {
  const count = items.filter(has).length;
  return count === items.length ? 'all' : count ? 'some' : 'none';
};

/** "3 of 10" for the tooltip of a badge some items have. */
const countHint = <T>(items: readonly T[], has: (item: T) => boolean) =>
  i18n.t('group.someHint', [items.filter(has).length, items.length]);

/** The insurance all items have, if they have the same one. */
function insuranceBadge(insurances: readonly (Insurance | undefined)[]): GroupBadge | undefined {
  const labels = new Set(
    insurances.map((insurance) => (insurance ? insuranceLabel(insurance) : '')),
  );
  const first = insurances[0];
  if (labels.size !== 1 || !first) return undefined;
  return {
    key: 'insurance',
    text: insuranceLabel(first),
    className: `is-insurance${first.lifetime ? ' is-lti' : ''}`,
    hint: i18n.t('insurance.badgeTitle'),
  };
}

/** Gift and Melt as on a single row, for all, some or none. */
function flagBadge<T>(
  key: 'gift' | 'melt',
  items: readonly T[],
  has: (item: T) => boolean,
  hints: { yes: string; no: string },
): GroupBadge {
  const share = shareOf(items, has);
  const label = key === 'gift' ? 'Gift' : 'Melt';
  return {
    key,
    text: share === 'some' ? i18n.t(`group.some.${key}`) : label,
    className: `is-${key}`,
    off: share === 'none',
    hint: share === 'some' ? countHint(items, has) : share === 'all' ? hints.yes : hints.no,
  };
}

/** The refund countdown of the item with the least time left, as its single row shows it. */
function refundBadge(items: readonly PledgeView[], today: string): GroupBadge | undefined {
  const windows = items.flatMap((item) => {
    const placedAt = item.order?.placedAt;
    const window = placedAt ? refundWindow(placedAt, today) : undefined;
    return window && placedAt ? [{ ...window, placedAt }] : [];
  });
  if (!windows.length) return undefined;
  const next = windows.reduce((a, b) => (b.daysLeft < a.daysLeft ? b : a));
  return {
    key: 'refund',
    text: next.daysLeft === 0 ? i18n.t('refund.lastDay') : i18n.n('refund.days', next.daysLeft),
    className: `is-refund${next.daysLeft < REFUND_URGENT_DAYS ? ' is-urgent' : ''}`,
    hint: [
      i18n.t('refund.hint', [next.placedAt, REFUND_DAYS, next.until]),
      i18n.t('group.refundCount', [windows.length, items.length]),
    ].join('\n'),
  };
}

/** A label of the CCU Consultant, by all or some items, with the first item's tooltip. */
function ccuBadge(
  key: 'baseMissing' | 'alwaysAvailable',
  hints: readonly (string | undefined)[],
): GroupBadge | undefined {
  const count = hints.filter(Boolean).length;
  if (!count) return undefined;
  const all = count === hints.length;
  return {
    key,
    text: all
      ? i18n.t(key === 'baseMissing' ? 'ccuCoverage.missing' : 'ccuCoverage.alwaysAvailable')
      : i18n.t(`group.some.${key}`),
    className: key === 'baseMissing' ? 'is-base-missing' : 'is-always-available',
    hint: all
      ? hints.find(Boolean)
      : `${hints.find(Boolean)}\n${i18n.t('group.someHint', [count, hints.length])}`,
  };
}

/** "Rebuyable" of Melt and Rebuy (#530) for all or some items, as a single row's label. */
export function rebuyBadge(
  items: readonly { id: number }[],
  rebuy: NonNullable<GroupBadgeContext['rebuy']>,
): GroupBadge | undefined {
  const summary = rebuySummary(
    rebuy.entries,
    items.map((item) => item.id),
  );
  if (!summary.count) return undefined;
  const all = summary.count === items.length;
  const hint = rebuyGroupHint(summary, { hideValues: rebuy.hideValues });
  return {
    key: 'rebuyable',
    text: i18n.t(all ? 'meltRebuy.label' : 'meltRebuy.groupSome'),
    className: 'is-rebuyable',
    hint: all ? hint : `${hint}\n${i18n.t('group.someHint', [summary.count, items.length])}`,
  };
}

/**
 * The badges of a group of "My Hangar": the refund countdown, the CCU Consultant's labels,
 * "Rebuyable", insurance, upgraded, Gift and Melt. Without `context`, only those of the items themselves.
 */
export function pledgeGroupBadges(
  group: ItemGroup<PledgeView>,
  context?: GroupBadgeContext,
): GroupBadge[] {
  const { items } = group;
  const upgraded = shareOf(items, (item) => item.isUpgraded);
  const ccus = context && items.every((item) => item.isCcu);
  return [
    context?.marks && context.now !== undefined
      ? meltMarkBadge(items, context.marks, context.now, context.locale)
      : undefined,
    context && refundBadge(items, context.today),
    ccus
      ? ccuBadge(
          'baseMissing',
          items.map(
            (item) =>
              baseMissingOf(
                context.coverageOf(item.id),
                context.alwaysAvailable,
                context.ships,
                context.leaving,
              )?.note,
          ),
        )
      : undefined,
    ccus
      ? ccuBadge(
          'alwaysAvailable',
          items.map((item) =>
            alwaysAvailableHintOf(
              context.coverageOf(item.id),
              context.alwaysAvailable,
              context.locale,
            ),
          ),
        )
      : undefined,
    context?.rebuy && rebuyBadge(items, context.rebuy),
    insuranceBadge(items.map((item) => item.insurance)),
    upgraded === 'none'
      ? undefined
      : {
          key: 'upgraded',
          text: upgraded === 'all' ? i18n.t('pledge.upgraded') : i18n.t('group.some.upgraded'),
          className: 'is-upgraded',
          ...(upgraded === 'some' && { hint: countHint(items, (item) => item.isUpgraded) }),
        },
    flagBadge('gift', items, (item) => item.isGiftable, {
      yes: i18n.t('pledge.giftable'),
      no: i18n.t('pledge.notGiftable'),
    }),
    flagBadge('melt', items, (item) => item.isMeltable, {
      yes: i18n.t('pledge.meltable'),
      no: i18n.t('pledge.notMeltable'),
    }),
  ].filter((badge): badge is GroupBadge => !!badge);
}

/** A time left, short for a range: whole hours from an hour on, else minutes. */
function hoursLeft(ms: number, locale: Locale): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return formatTimeLeft(ms, locale);
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'hour',
    unitDisplay: 'short',
  }).format(Math.ceil(minutes / 60));
}

/**
 * The melt label of a group with items marked to melt (#552): the times of its marked items – one,
 * or the earliest and the latest ("Melt in 3 hr – 21 hr", "Melt now – 21 hr", "Melt now") – with
 * the count of marked items as a badge, and both in words in its tooltip.
 */
export function meltMarkBadge(
  items: readonly { id: number }[],
  marks: ReadonlyMap<number, MarkedPledge>,
  now: number,
  locale: Locale,
): GroupBadge | undefined {
  const times = items
    .flatMap((item) => {
      const mark = marks.get(item.id);
      return mark ? [mark.meltableAt - now] : [];
    })
    .sort((a, b) => a - b);
  if (!times.length) return undefined;
  const first = times[0]!;
  const last = times[times.length - 1]!;
  const ready = times.filter((left) => left <= 0).length;
  const number = new Intl.NumberFormat(locale);
  let text: string;
  if (last <= 0) text = i18n.t('meltMark.ready');
  else if (first > 0 && hoursLeft(first, locale) === hoursLeft(last, locale)) {
    text = i18n.t('meltMark.waiting', [formatTimeLeft(first, locale)]);
  } else if (first <= 0) text = i18n.t('group.meltNowRange', [hoursLeft(last, locale)]);
  else text = i18n.t('group.meltRange', [hoursLeft(first, locale), hoursLeft(last, locale)]);
  const counts = [number.format(times.length), number.format(items.length)];
  return {
    key: 'meltMark',
    text,
    icon: 'recycle',
    count: number.format(times.length),
    className: `is-melt-mark${last <= 0 ? ' is-ready' : ''}`,
    hint: ready
      ? i18n.t('group.meltMarkHintReady', [...counts, number.format(ready)])
      : i18n.t('group.meltMarkHint', [...counts, formatTimeLeft(first, locale)]),
  };
}

/** The badges of a group of "Buy Back": insurance, not available again, probably giftable. */
export function buybackGroupBadges(group: ItemGroup<BuybackView>): GroupBadge[] {
  const { items } = group;
  const unavailable = shareOf(items, (item) => !!item.unavailable);
  const giftable = shareOf(items, (item) => item.isProbablyGiftable);
  return [
    insuranceBadge(items.map((item) => item.insurance)),
    unavailable === 'none'
      ? undefined
      : {
          key: 'unavailable',
          text:
            unavailable === 'all'
              ? i18n.t('buyback.unavailable')
              : i18n.t('group.some.unavailable'),
          className: 'is-unavailable',
          hint: countHint(items, (item) => !!item.unavailable),
        },
    giftable === 'none'
      ? undefined
      : {
          key: 'giftable',
          text:
            giftable === 'all'
              ? i18n.t('filter.probablyGiftable')
              : i18n.t('group.some.probablyGiftable'),
          className: 'is-giftable',
          hint: countHint(items, (item) => item.isProbablyGiftable),
        },
  ].filter((badge): badge is GroupBadge => !!badge);
}

/** The note on the extras that differ, e.g. "Some with gear, different insurance". */
export function extrasNote(extras: readonly GroupExtra[]): string | undefined {
  if (!extras.length) return undefined;
  const text = extras.map((extra) => i18n.t(`group.extras.${extra}`)).join(', ');
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** The kind icon of a group's first item, as its single row shows it. */
export const pledgeGroupKind = (group: ItemGroup<PledgeView>): IconName | undefined => {
  const first = group.items[0]!;
  return kindIcon({ ...first, isReward: !!first.reward });
};
export const buybackGroupKind = (group: ItemGroup<BuybackView>): IconName | undefined => {
  const first = group.items[0]!;
  return kindIcon({ ...first, isReward: isRewardTitle(first.title) });
};

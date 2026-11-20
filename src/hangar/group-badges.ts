import type { BuybackView } from '@/buyback/buyback-view';
import { i18n } from '@/i18n';
import type { IconName } from '@/icons/icon-names';
import type { GroupExtra, GroupShare, ItemGroup } from './grouping';
import { insuranceLabel, type Insurance } from './insurance';
import { kindIcon } from './pledge-kind';
import type { PledgeView } from './pledge-view';
import { isRewardTitle } from './rewards';

/*
 * What the row of a group shows besides its sums (#448): the badges of its items by the same rule
 * as a single row's – all of them, some of them ("Some gift") or none (the off state) – and a note
 * on the extras that differ ("some with gear, different insurance"). An insurance shows while all
 * items have the same one; otherwise the note tells it.
 */

export interface GroupBadge {
  key: string;
  text: string;
  /** Classes of the single row's badge (row.css), e.g. `is-insurance is-lti`. */
  className?: string;
  /** None of the items has it: struck through, as a single row's off badge. */
  off?: boolean;
  hint?: string;
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

/** The badges of a group of "My Hangar": insurance, upgraded, Gift and Melt. */
export function pledgeGroupBadges(group: ItemGroup<PledgeView>): GroupBadge[] {
  const { items } = group;
  const upgraded = shareOf(items, (item) => item.isUpgraded);
  return [
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

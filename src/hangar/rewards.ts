import type { RewardVisibility } from '@/settings/settings';

/**
 * Reward pledges are the ones RSI lists with a value of $0. Concierge and event rewards are
 * recognized by their names; everything else (referral bonuses, subscriber items, …) is "other".
 */
export type RewardKind = 'concierge' | 'event' | 'other';

const CONCIERGE = /\bVIP\b|chairman['’]s club|concierge/i;

const EVENT = new RegExp(
  [
    'luminalia',
    'day of the vara',
    'resource drive',
    '\\bBIS\\b',
    'best in show',
    'ship showdown',
    'RSI Disc\\.',
    'foundation fest',
    'alliance aid',
    '\\bAA (support|defense|collections|transport)\\b',
    'pirate week',
    'citizencon',
    'invictus',
    '\\bIAE\\b',
    'anniversary',
    'red festival',
    'year of the',
    'coramor',
    'stella fortuna',
    'xenothreat',
    'jumptown',
    'frontier fighters',
    'digital goodies',
    'advent',
    'murray cup',
    'tempt fate',
    'hunt the polaris',
    'pyro resupply',
    'training mission',
    'million reward',
    'birthday',
  ].join('|'),
  'i',
);

export function rewardKind(pledge: { title: string; value: string; valueUsd: number }) {
  if (!pledge.value || pledge.valueUsd !== 0) return undefined;
  if (CONCIERGE.test(pledge.title)) return 'concierge';
  if (EVENT.test(pledge.title)) return 'event';
  return 'other';
}

/** Whether a pledge with this reward kind is hidden by the reward setting. */
export function isHiddenReward(
  kind: RewardKind | undefined,
  visibility: RewardVisibility,
): boolean {
  if (!kind) return false;
  switch (visibility) {
    case 'hideAll':
      return true;
    case 'hideConcierge':
      return kind === 'concierge';
    case 'hideEvent':
      return kind === 'event';
    default:
      return false;
  }
}

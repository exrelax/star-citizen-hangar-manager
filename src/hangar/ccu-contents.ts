import { hasSeveralItems, mainItem, type BuybackPledge } from '@/buyback/buyback';
import { i18n } from '@/i18n';
import type { RefinementOption } from './filters';
import { parseInsurance } from './insurance';
import type { PledgeUpgrade } from './pledge';

/*
 * CCUs by what they bring besides their target ship (#566), for the refinement of the filter
 * "CCUs" next to its options by base ship (#461, #419):
 *
 * - `solo`: only the target ship; an insurance it brings doesn't count (it only betters the
 *   pledge's own, see `insurance.ts`);
 * - `extras`: more than the target ship, e.g. a paint or gear.
 *
 * In My Hangar by the CCU's target items (RSI lists the target ship and what comes with it). The
 * buy back names its items only for pledges with several of them: one item is the target ship
 * alone, and a CCU whose items weren't read (#334) has no kind.
 */

export type CcuContents = 'solo' | 'extras';

const isInsurance = (name: string) => /\binsurance\b/i.test(name) || !!parseInsurance(name);

/** What a CCU of My Hangar brings; none without its target items. */
export function hangarCcuContents(
  upgrade: Pick<PledgeUpgrade, 'targetItems'> | undefined,
): CcuContents | undefined {
  if (!upgrade?.targetItems.length) return undefined;
  const brought = upgrade.targetItems.filter((item) => !isInsurance(item.name));
  return brought.length > 1 ? 'extras' : 'solo';
}

/** What a CCU of the buy back brings; none for another pledge or unread items. */
export function buybackCcuContents(
  pledge: Pick<BuybackPledge, 'isUpgrade' | 'contained' | 'items'>,
): CcuContents | undefined {
  if (!pledge.isUpgrade) return undefined;
  if (!hasSeveralItems(pledge)) return 'solo';
  if (!pledge.items?.length) return undefined;
  const main = mainItem(pledge);
  const brought = pledge.items.filter((item) => item !== main && !isInsurance(item));
  return brought.length ? 'extras' : 'solo';
}

/** "All CCUs" alone, where the filter has no options by base ship. */
export const allCcus = <T>(): RefinementOption<T>[] => [
  { id: 'all', label: i18n.t('filter.ccuCoverage.all') },
];

/**
 * The refinement of the filter "CCUs": its options by base ship (`byBase`, "all" first) and those
 * by contents, each in a section of its own under "all"; without options by base ship (the buy
 * back) no sections.
 */
export function ccuRefinementWithContents<T>(
  byBase: readonly RefinementOption<T>[],
  contentsOf: (entry: T) => CcuContents | undefined,
): RefinementOption<T>[] {
  const [all, ...base] = byBase;
  const baseSection = i18n.t('filter.ccuContents.baseSection');
  const contentsSection = base.length ? i18n.t('filter.ccuContents.section') : undefined;
  return [
    ...(all ? [all] : []),
    ...base.map((option) => ({ ...option, section: baseSection })),
    {
      id: 'solo',
      label: i18n.t('filter.ccuContents.solo'),
      short: i18n.t('filter.ccuContents.soloShort'),
      ...(contentsSection && { section: contentsSection }),
      matches: (entry) => contentsOf(entry) === 'solo',
    },
    {
      id: 'extras',
      label: i18n.t('filter.ccuContents.extras'),
      short: i18n.t('filter.ccuContents.extrasShort'),
      ...(contentsSection && { section: contentsSection }),
      matches: (entry) => contentsOf(entry) === 'extras',
    },
  ];
}

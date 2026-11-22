import { hasSeveralItems, mainItem, type BuybackPledge } from '@/buyback/buyback';
import { i18n } from '@/i18n';
import type { RefinementOption } from './filters';
import { parseInsurance } from './insurance';
import { isShipBaseItem } from './ship-kind';
import type { Pledge, PledgeUpgrade } from './pledge';

/*
 * CCUs by what they bring besides their target ship (#566), for the refinement of the filter
 * "CCUs" next to its options by base ship (#461, #419):
 *
 * - `solo`: only the target ship; an insurance it brings doesn't count (it only betters the
 *   pledge's own, see `insurance.ts`), nor a hangar, poster, model or module, as with ships
 *   (#514);
 * - `extras`: more than the target ship, e.g. a paint or gear.
 *
 * In My Hangar by the CCU's target items (RSI lists the target ship and what comes with it). The
 * buy back shows only a CCU's title, so a CCU there counts like one of the same title in the hangar
 * (e.g. "Upgrade - MOLE to Asgard Warbond Edition" with its Best in Show paint), with extras if any
 * of them has some; without one it is a solo CCU. Where RSI names its items (a pledge with several),
 * they count instead, and a CCU whose items weren't read (#334) has no kind.
 */

export type CcuContents = 'solo' | 'extras';

/** An insurance, or a hangar, poster, model or module as they come with a ship (#514): no extra. */
const isNoExtra = (name: string) => isShipBaseItem(name) || !!parseInsurance(name);

/** What a CCU of My Hangar brings; none without its target items. */
export function hangarCcuContents(
  upgrade: Pick<PledgeUpgrade, 'targetItems'> | undefined,
): CcuContents | undefined {
  if (!upgrade?.targetItems.length) return undefined;
  const brought = upgrade.targetItems.filter((item) => !isNoExtra(item.name));
  return brought.length > 1 ? 'extras' : 'solo';
}

const titleKey = (title: string) => title.trim().toLowerCase();

export type BuybackCcuContents = ReturnType<typeof createBuybackCcuContents>;

/** What a CCU of the buy back brings, by the CCUs of the hangar; none for another pledge. */
export function createBuybackCcuContents(
  hangarPledges: readonly Pick<Pledge, 'title' | 'upgrade'>[] = [],
) {
  const byTitle = new Map<string, CcuContents>();
  for (const pledge of hangarPledges) {
    const contents = hangarCcuContents(pledge.upgrade);
    const key = titleKey(pledge.title);
    if (contents && byTitle.get(key) !== 'extras') byTitle.set(key, contents);
  }
  return (
    pledge: Pick<BuybackPledge, 'isUpgrade' | 'title' | 'contained' | 'items'>,
  ): CcuContents | undefined => {
    if (!pledge.isUpgrade) return undefined;
    if (!hasSeveralItems(pledge)) return byTitle.get(titleKey(pledge.title)) ?? 'solo';
    if (!pledge.items?.length) return undefined;
    const main = mainItem(pledge);
    const brought = pledge.items.filter((item) => item !== main && !isNoExtra(item));
    return brought.length ? 'extras' : 'solo';
  };
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

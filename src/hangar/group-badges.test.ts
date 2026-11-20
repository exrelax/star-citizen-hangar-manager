import { describe, expect, it } from 'vitest';
import type { BuybackView } from '@/buyback/buyback-view';
import { buybackGroupBadges, extrasNote, pledgeGroupBadges } from './group-badges';
import { groupItems } from './grouping';
import type { PledgeView } from './pledge-view';

const pledge = (overrides: Partial<PledgeView>) =>
  ({
    id: Math.random(),
    title: 'Upgrade - Nova to RAFT',
    isGiftable: true,
    isMeltable: true,
    isUpgraded: false,
    ...overrides,
  }) as PledgeView;
const groupOf = <T>(items: T[]) =>
  groupItems(items, () => ({ key: 'x', extras: {}, giftable: true }))[0]!;
const texts = (badges: { text: string; off?: boolean }[]) =>
  badges.map((badge) => `${badge.text}${badge.off ? ' (off)' : ''}`);

describe('the badges of a group row (#448)', () => {
  it('show Gift and Melt for all, some or none of the items', () => {
    expect(texts(pledgeGroupBadges(groupOf([pledge({}), pledge({})])))).toEqual(['Gift', 'Melt']);
    const some = pledgeGroupBadges(groupOf([pledge({ isGiftable: false }), pledge({})]));
    expect(texts(some)).toEqual(['Some gift', 'Melt']);
    expect(some[0]!.hint).toBe('1 of 2');
    const none = pledgeGroupBadges(
      groupOf([
        pledge({ isGiftable: false, isMeltable: false }),
        pledge({ isGiftable: false, isMeltable: false }),
      ]),
    );
    expect(texts(none)).toEqual(['Gift (off)', 'Melt (off)']);
  });

  it('show an insurance all items share, and upgraded for all or some', () => {
    const lti = { lifetime: true } as const;
    const badges = pledgeGroupBadges(
      groupOf([pledge({ insurance: lti, isUpgraded: true }), pledge({ insurance: lti })]),
    );
    expect(texts(badges)).toEqual(['LTI', 'Some upgraded', 'Gift', 'Melt']);
    expect(badges[0]!.className).toBe('is-insurance is-lti');
    // Different insurances: no badge, the note tells it.
    const mixed = pledgeGroupBadges(
      groupOf([
        pledge({ insurance: lti }),
        pledge({ insurance: { lifetime: false, months: 120 } }),
      ]),
    );
    expect(texts(mixed)).toEqual(['Gift', 'Melt']);
  });

  it('show the buy back’s own labels', () => {
    const item = (overrides: Partial<BuybackView>) =>
      ({ id: Math.random(), title: 'x', isProbablyGiftable: true, ...overrides }) as BuybackView;
    expect(texts(buybackGroupBadges(groupOf([item({}), item({})])))).toEqual(['Probably giftable']);
    expect(
      texts(buybackGroupBadges(groupOf([item({ isProbablyGiftable: false }), item({})]))),
    ).toEqual(['Some probably giftable']);
    expect(texts(buybackGroupBadges(groupOf([item({ isProbablyGiftable: false })])))).toEqual([]);
  });

  it('tell the extras that differ in one note', () => {
    expect(extrasNote(['gear', 'bisPaint', 'insurance'])).toBe(
      'Some with gear, some with BIS paint, different insurance',
    );
    expect(extrasNote([])).toBeUndefined();
  });
});

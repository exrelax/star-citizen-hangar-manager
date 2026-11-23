// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { filterRequestOf, openListShortcut, listShortcuts } from '@/hangar/list-shortcut';
import { ccuBaseShipShortcut, ccuBuybackShortcut, ccuGroupShortcut } from './consultant-shortcuts';

describe('the List Shortcuts of the CCU Consultant (#563)', () => {
  it('opens My Hangar with the CCUs of a group', () => {
    openListShortcut(ccuGroupShortcut('buyback', [10, 11]));
    const open = listShortcuts.value.hangar!;
    expect(open.id).toBe('ccuConsultant:buyback');
    expect(filterRequestOf(open)).toMatchObject({
      title: 'CCU Consultant: Only via buy back',
      icon: 'link',
      emptyText: 'None of these CCUs is in your hangar any more.',
    });
    expect([10, 11, 12].map((id) => open.matches({ id } as never))).toEqual([true, true, false]);
  });

  it('names the tab "Discount at risk" by its title', () => {
    expect(ccuGroupShortcut('atRisk', []).title).toBeTypeOf('function');
    openListShortcut(ccuGroupShortcut('atRisk', [1]));
    expect(listShortcuts.value.hangar!.title()).toBe('CCU Consultant: Discount at risk');
  });

  it('opens the CCUs from a base ship and the buy back’s ways to it', () => {
    openListShortcut(ccuBaseShipShortcut('id:2', 'Cutlass Red', [10]));
    expect(listShortcuts.value.hangar!.title()).toBe('CCUs from Cutlass Red');
    openListShortcut(ccuBuybackShortcut('id:2', 'Cutlass Red', [80]));
    const buyback = listShortcuts.value.buyback!;
    expect(buyback.id).toBe('ccuConsultant:to:id:2');
    expect(buyback.title()).toBe('Ships and CCUs to Cutlass Red');
    expect(buyback.matches({ id: 80 } as never)).toBe(true);
    expect(location.hash).toBe('#hangar-manager-bb');
  });
});

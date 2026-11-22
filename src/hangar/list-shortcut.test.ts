// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { setLocale } from '@/i18n';
import { paintRebuys } from '@/store/paint-consultant/use-paint-consultant';
import type { PaintRebuy } from '@/store/paint-consultant/use-paint-consultant';
import { meltRebuyShortcut } from '@/melt-rebuy/rebuy-shortcut';
import type { Rebuy } from '@/melt-rebuy/rebuyable';
import type { PledgeView } from './pledge-view';
import type { BuybackView } from '@/buyback/buyback-view';
import { MELT_READY_SHORTCUT, PAINT_REBUY_SHORTCUT } from './hangar-shortcuts';
import {
  closeListShortcut,
  filterRequestOf,
  isListShortcutOpen,
  listShortcuts,
  openListShortcut,
  toggleListShortcut,
} from './list-shortcut';
import { hashOfTab } from './route';
import { meltReadyIds } from './use-melt-marks';

const pledge = (id: number, extra: Partial<PledgeView> = {}) => ({ id, ...extra }) as PledgeView;
const buyback = (id: number) => ({ id }) as BuybackView;

afterEach(() => {
  listShortcuts.value = { hangar: null, buyback: null };
  meltReadyIds.value = new Set();
  paintRebuys.value = new Map();
  location.hash = '';
});

describe('openListShortcut (#428)', () => {
  it('opens the list with the pledges of its ids', () => {
    openListShortcut({ list: 'hangar', id: 'colliding', title: 'Colliding CCUs', ids: [2, 3] });
    expect(location.hash).toBe('#hangar-manager');
    const open = listShortcuts.value.hangar!;
    expect(open.id).toBe('colliding');
    expect(open.title()).toBe('Colliding CCUs');
    expect([1, 2, 3].map((id) => open.matches(pledge(id)))).toEqual([false, true, true]);
    expect(listShortcuts.value.buyback).toBeNull();
  });

  it('takes the ids as they are when it opens', () => {
    const ids = [1];
    openListShortcut({ list: 'hangar', id: 'a', title: 'A', ids });
    ids.push(2);
    expect(listShortcuts.value.hangar!.matches(pledge(2))).toBe(false);
  });

  it('follows a rule, also together with ids', () => {
    openListShortcut({
      list: 'hangar',
      id: 'ccus',
      title: 'CCUs',
      ids: [1, 2],
      matches: (p) => !!p.isCcu,
    });
    const { matches } = listShortcuts.value.hangar!;
    expect(matches(pledge(1, { isCcu: true }))).toBe(true);
    expect(matches(pledge(2, { isCcu: false }))).toBe(false);
    expect(matches(pledge(3, { isCcu: true }))).toBe(false);
  });

  it('opens in the buy back, next to the one of My Hangar', () => {
    openListShortcut({ list: 'hangar', id: 'a', title: 'A', ids: [1] });
    openListShortcut({ list: 'buyback', id: 'b', title: 'B', ids: [5] });
    expect(location.hash).toBe(hashOfTab('buyback'));
    expect(listShortcuts.value.hangar?.id).toBe('a');
    expect(listShortcuts.value.buyback!.matches(buyback(5))).toBe(true);
  });

  it('replaces the open one, and starts anew when opened again', () => {
    openListShortcut({ list: 'hangar', id: 'a', title: 'A' });
    const first = listShortcuts.value.hangar!.at;
    openListShortcut({ list: 'hangar', id: 'a', title: 'A' });
    expect(listShortcuts.value.hangar!.at).toBeGreaterThan(first);
    openListShortcut({ list: 'hangar', id: 'b', title: 'B' });
    expect(listShortcuts.value.hangar!.id).toBe('b');
  });

  it('closes, only the one asked for', () => {
    openListShortcut({ list: 'hangar', id: 'a', title: 'A' });
    closeListShortcut('hangar', 'b');
    expect(isListShortcutOpen('hangar', 'a')).toBe(true);
    closeListShortcut('hangar', 'a');
    expect(listShortcuts.value.hangar).toBeNull();
    openListShortcut({ list: 'hangar', id: 'a', title: 'A' });
    closeListShortcut('hangar');
    expect(listShortcuts.value.hangar).toBeNull();
  });

  it('toggles', () => {
    const definition = { list: 'hangar' as const, id: 'a', title: 'A' };
    toggleListShortcut(definition);
    expect(isListShortcutOpen('hangar', 'a')).toBe(true);
    toggleListShortcut(definition);
    expect(isListShortcutOpen('hangar', 'a')).toBe(false);
  });
});

describe('filterRequestOf', () => {
  it('gives the list its texts in today’s language', () => {
    const extra = defineComponent({ render: () => null });
    openListShortcut({
      list: 'hangar',
      id: 'a',
      title: () => 'Title',
      icon: 'palette',
      emptyText: 'Nothing',
      extra,
    });
    const request = filterRequestOf(listShortcuts.value.hangar)!;
    expect(request).toMatchObject({ title: 'Title', icon: 'palette', emptyText: 'Nothing' });
    expect(request.at).toBe(listShortcuts.value.hangar!.at);
    expect(listShortcuts.value.hangar!.extra).toBe(extra);
    expect(filterRequestOf(null)).toBeNull();
  });
});

describe('the shortcuts of the sidebar on the mechanism (#428)', () => {
  afterEach(() => setLocale('en'));

  it('“Show” of the pledges ready to melt: the marked ones that can be melted now', () => {
    toggleListShortcut(MELT_READY_SHORTCUT);
    const request = filterRequestOf(listShortcuts.value.hangar)!;
    expect(request).toMatchObject({ title: 'Ready to melt', icon: 'recycle' });
    expect(request.emptyText).toBe('No marked pledge can be melted right now.');
    expect(request.matches(pledge(1))).toBe(false);
    // The rule follows the marks.
    meltReadyIds.value = new Set([1]);
    expect(request.matches(pledge(1))).toBe(true);
    toggleListShortcut(MELT_READY_SHORTCUT);
    expect(listShortcuts.value.hangar).toBeNull();
  });

  it('“Show these paints” of the Paint Discount Consultant: the paints of its plan', () => {
    paintRebuys.value = new Map([[7, {} as PaintRebuy]]);
    toggleListShortcut(PAINT_REBUY_SHORTCUT);
    setLocale('de');
    const request = filterRequestOf(listShortcuts.value.hangar)!;
    expect(request.title).toBe('Paints zum Optimieren');
    expect(request.emptyText).toBe('Im Plan sind keine Paints mehr zum Rückkauf.');
    expect([7, 8].map((id) => request.matches(pledge(id)))).toEqual([true, false]);
  });

  it('“Melt and rebuy”: the rebuyable pledges, with its bar', () => {
    const rebuys = shallowRef<ReadonlyMap<number, Rebuy>>(new Map());
    openListShortcut(meltRebuyShortcut(rebuys));
    const open = listShortcuts.value.hangar!;
    expect(open.title()).toBe('Melt and rebuy');
    expect(open.extra).toBeDefined();
    expect(open.matches(pledge(3))).toBe(false);
    rebuys.value = new Map([[3, { rebuyable: true } as Rebuy]]);
    expect(open.matches(pledge(3))).toBe(true);
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { PLEDGE_FILTER_PREDICATES } from '@/hangar/filters';
import { MELT_READY_SHORTCUT, PAINT_REBUY_SHORTCUT } from '@/hangar/hangar-shortcuts';
import {
  filterRequestOf,
  listShortcuts,
  openListShortcut,
  type ListShortcutDefinition,
} from '@/hangar/list-shortcut';
import { meltableAt } from '@/hangar/melt-marks';
import type { PledgeView } from '@/hangar/pledge-view';
import { meltReadyIds, readyToMelt, type MarkedPledge } from '@/hangar/use-melt-marks';
import { meltRebuyShortcut } from '@/melt-rebuy/rebuy-shortcut';
import type { Rebuy } from '@/melt-rebuy/rebuyable';
import { planPaintRebuy } from '@/store/paint-consultant/calculation';
import { paintRebuys, paintRebuysOf } from '@/store/paint-consultant/use-paint-consultant';
import { warbondCollisionsShortcut } from '@/store/warbond-collisions-shortcut';
import { buildWarbondOffers } from '@/store/warbond';
import { DEFAULT_SETTINGS } from '@/settings/settings';
import { demoCatalog, FALLBACK_CATALOG } from './catalog';
import { demoPurchaseTime, generatedDemo, justBoughtOf } from './demo';
import {
  demoGroupMarks,
  demoMarkIds,
  demoMarkTimes,
  withRecentPurchases,
} from './demo-group-marks';
import { DEFAULT_DEMO_SETTINGS, type DemoSettings } from './demo-settings';
import { demoStoreData } from './demo-store';

/*
 * The List Shortcuts in the demo (#431): each shortcut of My Hangar opens with pledges of the demo
 * hangar on every demo key, search and filters narrow it, and its empty state can be reached.
 * "Melt and rebuy" (#530) has its cases and its demo setting "Rebuyable pledges" in
 * `demo-rebuy-cases.test.ts`. No shortcut opens the Buy Back yet.
 */

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const KEYS = ['key-a', 'key-b', 'key-c', 'another key'];

afterEach(() => {
  listShortcuts.value = { hangar: null, buyback: null };
  meltReadyIds.value = new Set();
  paintRebuys.value = new Map();
  location.hash = '';
});

/** The demo hangar as the manager shows it, with the demo's marks as `use-demo.ts` sets them. */
function demo(key: string, settings: Partial<DemoSettings> = {}) {
  const demoSettings = { ...DEFAULT_DEMO_SETTINGS, ...settings };
  const generated = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW, demoSettings);
  const base = generated.pledges;
  const justBought = justBoughtOf(base);
  const own = demoMarkIds(base, justBought);
  const rebuyCases = generated.account.pledges.flatMap((pledge) =>
    pledge.demoRebuyCase ? [pledge.id] : [],
  );
  const groups = demoSettings.states.meltMarks
    ? demoGroupMarks(base, NOW, new Set([...own, ...rebuyCases]))
    : { marked: [], purchases: new Map<number, string>() };
  const pledges = withRecentPurchases(base, groups.purchases);
  const times = demoSettings.states.meltMarks ? demoMarkTimes([...own, ...groups.marked], NOW) : {};
  const purchaseOf = (id: number) =>
    id === justBought ? demoPurchaseTime(NOW) : groups.purchases.get(id);
  const marks = new Map<number, MarkedPledge>(
    Object.entries(times).map(([id, markedAt]) => {
      const pledgeId = Number(id);
      const boughtOn = pledges.find((pledge) => pledge.id === pledgeId)?.createdAt;
      const at = meltableAt({ boughtAt: purchaseOf(pledgeId), boughtOn, markedAt });
      return [pledgeId, { pledgeId, markedAt, meltableAt: at }];
    }),
  );
  return { ...generated, pledges, marks };
}

/** Opens the shortcut as a place of the manager does, and the pledges its list then shows. */
function opened(definition: ListShortcutDefinition<'hangar'>, pledges: readonly PledgeView[]) {
  openListShortcut(definition);
  const request = filterRequestOf(listShortcuts.value.hangar)!;
  return { request, shown: pledges.filter(request.matches) };
}

/** The Paint Discount Consultant's result on the demo hangar, with its default settings. */
const paintPlanOf = (pledges: readonly PledgeView[]) =>
  planPaintRebuy({
    pledges,
    storeItems: FALLBACK_CATALOG.items,
    storeCredit: DEFAULT_DEMO_SETTINGS.storeCredit,
    useFillers: DEFAULT_SETTINGS.paintConsultant.useFillers,
    skipGiftable: DEFAULT_SETTINGS.paintConsultant.skipGiftable,
    guessRebought: false,
  });

describe.each(KEYS)('the List Shortcuts of the demo %s (#431)', (key) => {
  it('"Ready to melt" shows the demo’s marks ready to melt, never the one still waiting', () => {
    const { pledges, marks } = demo(key);
    const justBought = justBoughtOf(pledges)!;
    meltReadyIds.value = readyToMelt(marks, new Set(pledges.map((pledge) => pledge.id)), NOW);
    const { request, shown } = opened(MELT_READY_SHORTCUT, pledges);
    expect(request.title).toBe('Ready to melt');
    expect(location.hash).toBe('#hangar-manager');
    expect(shown.length).toBeGreaterThanOrEqual(2);
    expect(marks.has(justBought) && !shown.some((pledge) => pledge.id === justBought)).toBe(true);
    // A search within it leaves the pledges of one title: the marked paint or a group's items.
    const name = shown[0]!.title;
    expect(shown.filter((pledge) => pledge.title === name).length).toBeLessThan(shown.length);
  });

  it('"Ready to melt" is empty without the demo’s marks (setting off, then "Reset demo")', () => {
    const { pledges, marks } = demo(key, {
      states: { ...DEFAULT_DEMO_SETTINGS.states, meltMarks: false },
    });
    expect(marks.size).toBe(0);
    meltReadyIds.value = readyToMelt(marks, new Set(pledges.map((pledge) => pledge.id)), NOW);
    const { request, shown } = opened(MELT_READY_SHORTCUT, pledges);
    expect(shown).toEqual([]);
    expect(request.emptyText).toBeTruthy();
  });

  it('"Paints to optimize" shows the paints of the demo’s new plan', () => {
    const { pledges } = demo(key);
    paintRebuys.value = paintRebuysOf(paintPlanOf(pledges));
    const { request, shown } = opened(PAINT_REBUY_SHORTCUT, pledges);
    expect(request.title).toBe('Paints to optimize');
    expect(shown.length).toBeGreaterThanOrEqual(2);
    expect(shown.every((pledge) => pledge.isPaint)).toBe(true);
    // A search within it leaves just the paints of one of them.
    const name = shown[0]!.title;
    expect(shown.filter((pledge) => pledge.title === name).length).toBeLessThan(shown.length);
  });

  it('"Paints to optimize" is empty without a new plan (demo setting "A new plan" off)', () => {
    const { pledges } = demo(key, { newPlan: false });
    // What the consultant keeps of its result then (`demoWithoutNewPlan`): the paints bought
    // again only, none before the stage "Old paints left to melt".
    const { rebought } = paintPlanOf(pledges);
    paintRebuys.value = paintRebuysOf({ rebought });
    const { request, shown } = opened(PAINT_REBUY_SHORTCUT, pledges);
    expect(shown).toEqual([]);
    expect(request.emptyText).toBeTruthy();
  });

  it('shows the own CCUs colliding with a demo warbond CCU', () => {
    const { pledges, buyback } = demo(key);
    const catalog = demoCatalog(undefined, undefined);
    const offers = buildWarbondOffers(demoStoreData(catalog, pledges, NOW), pledges, buyback);
    const offer = offers.find((entry) => entry.owned.length >= 2);
    expect(offer).toBeDefined();
    const { request, shown } = opened(warbondCollisionsShortcut(offer!), pledges);
    expect(request.title).toContain(offer!.target.ship.name);
    expect(shown.length).toBe(offer!.owned.reduce((sum, ccu) => sum + ccu.ids.length, 0));
    expect(shown.every((pledge) => pledge.isCcu)).toBe(true);
    // A filter that matches none of them leaves nothing within the shortcut.
    expect(shown.filter(PLEDGE_FILTER_PREDICATES.paints)).toEqual([]);
  });
});

describe('"Melt and rebuy" in the demo (#431)', () => {
  it('opens on the rebuyable pledges and is empty without them', () => {
    const rebuys = shallowRef<ReadonlyMap<number, Rebuy>>(
      new Map([[1, { rebuyable: true, reasons: [] } as unknown as Rebuy]]),
    );
    const pledges = [{ id: 1 }, { id: 2 }] as PledgeView[];
    expect(opened(meltRebuyShortcut(rebuys), pledges).shown.map((p) => p.id)).toEqual([1]);
    rebuys.value = new Map();
    const { request, shown } = opened(meltRebuyShortcut(rebuys), pledges);
    expect(shown).toEqual([]);
    expect(request.emptyText).toBeTruthy();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { bytesOf, SYNC_QUOTA } from '@/watchlists/watchlists-storage';
import type { CompletedPaintPlan } from './completed-plans';
import type { StoredRebuyPlan } from './rebuy-plan-storage';
import {
  completedIdOf,
  decodeCompleted,
  decodePlan,
  encodeCompleted,
  encodePlan,
  loadCompleted,
  loadPlan,
  migratePaintPlans,
  PaintPlanQuotaError,
  planCompleted,
  planRunning,
  saveCompleted,
  savePlan,
  SYNCED_COMPLETED_KEPT,
  syncedCompletedItem,
  syncedPlanItem,
} from './synced-plans';

/* The paint plans in the synced storage (#635). */

beforeEach(() => fakeBrowser.reset());

const START = Date.parse('2026-11-20T18:00:00Z');
const HOUR = 3_600_000;

function plan(at = START): StoredRebuyPlan {
  return {
    version: 2,
    way: 'melt',
    at,
    creditAtStart: 42.5,
    tier: { paints: 5, percent: 25 },
    own: [
      {
        pledgeId: 101,
        title: 'Paints - Carrack - 2950 Best in Show Paint',
        skuId: 9001,
        meltValue: 12.35,
        price: 19,
        meltedAt: at + HOUR,
        freed: 12.35,
      },
      {
        pledgeId: 102,
        title: 'Paints - Cutlass - 2950 Best in Show Paint',
        skuId: 9002,
        meltValue: 4.35,
        seenGone: true,
        meltedAt: at + 2 * HOUR,
      },
    ],
    fillers: [{ skuId: 9100, name: 'Aurora - Ghoulish Green Paint', quantity: 3, price: 5 }],
    cartCost: 32.25,
    purchase: {
      orderId: 'ABC-123',
      boughtAt: '2026-11-20T19:55',
      pledgeIds: [201, 202, 203],
      foundAt: at + 3 * HOUR,
      notifiedAt: at + 27 * HOUR,
      ownPledgeIds: [204, 205],
      skus: { 201: 9100, 202: 9100, 203: 9100, 204: 9001, 205: 9002 },
    },
    fillersMelted: { 201: at + 28 * HOUR },
    recalculatedAt: at + 30 * 60_000,
    previousTier: { paints: 3, percent: 20 },
    checkEndedAt: at + 7 * 24 * HOUR,
  };
}

function completed(startedAt: number, way: 'buy' | 'melt' = 'buy'): CompletedPaintPlan {
  return {
    way,
    startedAt,
    completedAt: startedAt + 30 * HOUR,
    tier: { paints: 5, percent: 25 },
    orderId: 'ABC-123',
    ownCount: 1,
    fillerCount: 2,
    melted: [
      {
        skuId: 9001,
        name: 'Carrack - 2950 Best in Show Paint',
        count: 1,
        value: 12.35,
        filler: false,
      },
      { skuId: 9100, name: 'Aurora - Ghoulish Green Paint', count: 2, value: 7.5, filler: true },
    ],
    bought: [
      {
        skuId: 9001,
        name: 'Carrack - 2950 Best in Show Paint',
        count: 1,
        value: 14.25,
        filler: false,
      },
      { skuId: 9100, name: 'Aurora - Ghoulish Green Paint', count: 2, value: 7.5, filler: true },
    ],
    freed: 19.85,
    paid: 21.75,
    result: -1.9,
    creditBefore: 10,
    creditAfter: 8.1,
    meltBefore: 12.35,
    meltAfter: 14.25,
  };
}

const syncGet = () => fakeBrowser.storage.sync.get(null);

/** Something else stored that leaves `free` bytes of the synced storage. */
const leaving = (free: number) => ({
  big: 'x'.repeat(SYNC_QUOTA.total - free - bytesOf('big', '')),
});
const planSize = () => bytesOf('consultant.plan', encodePlan(plan()));
const completedSize = (startedAt: number) =>
  bytesOf(
    `consultant.done.${completedIdOf(completed(startedAt))}`,
    encodeCompleted(completed(startedAt)),
  );

describe('the compact formats', () => {
  it('give a running plan back as it was, with every fact', () => {
    expect(decodePlan(encodePlan(plan()))).toEqual(plan());
    const bare: StoredRebuyPlan = { ...plan(), own: [], fillers: [], purchase: undefined };
    delete bare.purchase;
    expect(decodePlan(encodePlan(bare))).toEqual(bare);
  });

  it('keep each paint name of a completed plan once', () => {
    const stored = encodeCompleted(completed(START));
    expect(stored.n).toEqual([
      'Carrack - 2950 Best in Show Paint',
      'Aurora - Ghoulish Green Paint',
    ]);
    expect(decodeCompleted(stored)).toEqual(completed(START));
  });

  it('are smaller than the plans', () => {
    expect(bytesOf('consultant.plan', encodePlan(plan()))).toBeLessThan(
      bytesOf('consultant.plan', plan()) * 0.75,
    );
    expect(bytesOf('x', encodeCompleted(completed(START)))).toBeLessThan(
      bytesOf('x', completed(START)) * 0.75,
    );
  });

  it('give nothing of another format', () => {
    expect(decodePlan({ version: 2, own: [] })).toBeUndefined();
    expect(decodePlan(null)).toBeUndefined();
    expect(decodeCompleted({ v: 2 })).toBeUndefined();
  });
});

describe('planCompleted', () => {
  it('keeps the newest ones in the synced storage, the others in this browser', () => {
    const plans = Array.from({ length: SYNCED_COMPLETED_KEPT + 3 }, (_, i) =>
      completed(START + i * 24 * HOUR),
    );
    const { writes, leftover } = planCompleted({}, plans);
    const ids = (writes['consultant.done'] as { ids: string[] }).ids;
    expect(ids).toHaveLength(SYNCED_COMPLETED_KEPT);
    expect(ids[0]).toBe(completedIdOf(plans.at(-1)!));
    expect(leftover.map((kept) => kept.startedAt)).toEqual(
      plans
        .slice(0, 3)
        .map((kept) => kept.startedAt)
        .reverse(),
    );
  });

  it('leaves out what doesn’t fit next to everything else stored', () => {
    // Room for one completed plan and the index only.
    const stored = leaving(completedSize(START) + 60);
    const { writes, leftover } = planCompleted(stored, [completed(START), completed(START + HOUR)]);
    expect(Object.keys(writes)).toHaveLength(2);
    expect(leftover).toHaveLength(1);
  });

  it('takes each plan once, by its start and way', () => {
    const { writes } = planCompleted({}, [
      completed(START),
      completed(START),
      completed(START, 'melt'),
    ]);
    expect((writes['consultant.done'] as { ids: string[] }).ids).toHaveLength(2);
  });
});

describe('planRunning', () => {
  it('lets the oldest completed plans give way when the storage is full', () => {
    const plans = [completed(START), completed(START + 24 * HOUR)];
    const { writes } = planCompleted({}, plans);
    const used = Object.entries(writes).reduce((sum, [key, value]) => sum + bytesOf(key, value), 0);
    // Room for the completed plans, and the running plan only without the older one.
    const stored = { ...writes, ...leaving(used + planSize() - completedSize(START) + 20) };
    expect(planRunning(stored, encodePlan(plan()))).toEqual({
      gaveWay: [completedIdOf(completed(START))],
      index: [completedIdOf(completed(START + 24 * HOUR))],
    });
  });

  it('fails for a plan bigger than a key, or a storage full without completed plans', () => {
    const huge = { ...plan(), own: Array.from({ length: 200 }, () => plan().own[0]!) };
    expect(planRunning({}, encodePlan(huge))).toBe('plan');
    expect(planRunning({ big: 'x'.repeat(SYNC_QUOTA.total) }, encodePlan(plan()))).toBe('total');
  });
});

describe('the running plan', () => {
  it('is kept in the synced storage and read back', async () => {
    await syncedPlanItem.setValue(plan());
    expect(Object.keys(await syncGet())).toEqual(['consultant.plan']);
    expect(await syncedPlanItem.getValue()).toEqual(plan());
    await syncedPlanItem.setValue(null);
    expect(await syncedPlanItem.getValue()).toBeNull();
  });

  it('moves completed plans that give way to this browser, never losing them', async () => {
    await saveCompleted([completed(START)]);
    const used = Object.entries(await syncGet()).reduce((sum, [k, v]) => sum + bytesOf(k, v), 0);
    await fakeBrowser.storage.sync.set(leaving(used + planSize() - 50));
    await savePlan(plan());
    const synced = await syncGet();
    expect(synced['consultant.plan']).toBeDefined();
    expect(synced['consultant.done']).toBeUndefined();
    expect(await loadCompleted()).toEqual([completed(START)]);
  });

  it("fails with a PaintPlanQuotaError and changes nothing if it doesn't fit", async () => {
    await savePlan(plan(START - HOUR));
    await fakeBrowser.storage.sync.set({ big: 'x'.repeat(SYNC_QUOTA.total) });
    await expect(savePlan(plan())).rejects.toBeInstanceOf(PaintPlanQuotaError);
    expect((await loadPlan())?.at).toBe(START - HOUR);
  });

  it('is read from this browser while it is there only', async () => {
    await storage.setItem('local:consultant.plan', plan());
    expect(await loadPlan()).toEqual(plan());
  });

  it('tells its watchers of changes', async () => {
    const seen: unknown[] = [];
    const stop = syncedPlanItem.watch((value) => seen.push(value));
    await savePlan(plan());
    await new Promise((resolve) => setTimeout(resolve, 0));
    stop();
    expect(seen.at(-1)).toEqual(plan());
  });
});

describe('the completed plans', () => {
  it('show the synced ones and those left in this browser, each once, newest first', async () => {
    await storage.setItem('local:consultant.history', {
      version: 1,
      plans: [completed(START), completed(START - 24 * HOUR)],
    });
    await saveCompleted([completed(START + 24 * HOUR), completed(START)]);
    const plans = (await syncedCompletedItem.getValue()).plans.map((kept) => kept.startedAt);
    expect(plans).toEqual([START + 24 * HOUR, START]);
    // What was left there and is kept now in the synced storage is gone from it.
    expect(await storage.getItem('local:consultant.history')).toBeNull();
  });
});

describe('migratePaintPlans', () => {
  it('moves the plan and the completed plans of this browser to the synced storage', async () => {
    const plans = Array.from({ length: 12 }, (_, i) => completed(START - i * 24 * HOUR));
    await storage.setItem('local:consultant.plan', plan());
    await storage.setItem('local:consultant.history', { version: 1, plans });

    await migratePaintPlans();

    const synced = await syncGet();
    expect(decodePlan(synced['consultant.plan'])).toEqual(plan());
    expect(await storage.getItem('local:consultant.plan')).toBeNull();
    expect((synced['consultant.done'] as { ids: string[] }).ids).toHaveLength(
      SYNCED_COMPLETED_KEPT,
    );
    // The two oldest stay here and are still shown: nothing is lost.
    const left = await storage.getItem<{ plans: CompletedPaintPlan[] }>('local:consultant.history');
    expect(left?.plans.map((kept) => kept.startedAt)).toEqual(
      plans.slice(10).map((p) => p.startedAt),
    );
    expect(await loadCompleted()).toEqual(plans);
  });

  it('keeps the newer running plan of another device, and merges the completed plans', async () => {
    await savePlan(plan(START + HOUR));
    await saveCompleted([completed(START + 24 * HOUR)]);
    await storage.setItem('local:consultant.plan', plan(START));
    await storage.setItem('local:consultant.history', { version: 1, plans: [completed(START)] });

    await migratePaintPlans();

    expect((await loadPlan())?.at).toBe(START + HOUR);
    expect(await storage.getItem('local:consultant.plan')).toBeNull();
    expect((await loadCompleted()).map((kept) => kept.startedAt)).toEqual([
      START + 24 * HOUR,
      START,
    ]);
    expect(await storage.getItem('local:consultant.history')).toBeNull();
  });

  it('takes this browser’s plan when it is newer than the synced one', async () => {
    await savePlan(plan(START));
    await storage.setItem('local:consultant.plan', plan(START + HOUR));
    await migratePaintPlans();
    expect((await loadPlan())?.at).toBe(START + HOUR);
  });

  it('leaves a plan that doesn’t fit in this browser, still shown', async () => {
    await fakeBrowser.storage.sync.set({ big: 'x'.repeat(SYNC_QUOTA.total) });
    await storage.setItem('local:consultant.plan', plan());
    await migratePaintPlans();
    expect(await storage.getItem('local:consultant.plan')).toEqual(plan());
    expect(await loadPlan()).toEqual(plan());
  });

  it('writes nothing once done', async () => {
    await storage.setItem('local:consultant.history', {
      version: 1,
      plans: Array.from({ length: 12 }, (_, i) => completed(START - i * 24 * HOUR)),
    });
    await migratePaintPlans();
    const before = JSON.stringify(await syncGet());
    let writes = 0;
    const listener = () => writes++;
    fakeBrowser.storage.onChanged.addListener(listener);
    await migratePaintPlans();
    fakeBrowser.storage.onChanged.removeListener(listener);
    expect(writes).toBe(0);
    expect(JSON.stringify(await syncGet())).toBe(before);
  });
});

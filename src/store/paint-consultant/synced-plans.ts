import { bytesOf, SYNC_QUOTA } from '@/watchlists/watchlists-storage';
import type { PaintTier } from './calculation';
import type { CompletedPaint, CompletedPaintPlan, CompletedPlansSnapshot } from './completed-plans';
import type {
  AnyStoredRebuyPlan,
  PlanPurchase,
  StoredOwnPaint,
  StoredRebuyPlan,
} from './rebuy-plan-storage';

/*
 * The running plan of the Paint Discount Planner and its completed plans in the browser's synced
 * storage (#635), so they follow the browser profile to other devices like the marks to melt and
 * the watchlists: a plan started on one device can be finished on another. The synced storage is
 * small (8 KB per key, 100 KB in all, 512 keys, `SYNC_QUOTA`), so:
 * - the running plan is one key (`sync:consultant.plan`), each completed plan one more
 *   (`sync:consultant.done.<id>`) with their order (`sync:consultant.done`), the last
 *   `SYNCED_COMPLETED_KEPT` only;
 * - they are stored compactly: short field names, a completed plan's paint names once each;
 * - every write is measured first. The running plan comes first: if it doesn't fit, the oldest
 *   completed plans give way. One that doesn't fit even then fails with a `PaintPlanQuotaError`
 *   and changes nothing.
 * Nothing is lost: completed plans that don't fit (or are older than the last ones kept) stay in
 * this browser's local storage under the key of earlier versions (`local:consultant.history`) and
 * are still shown; a running plan of the first format (version 1) stays under
 * `local:consultant.plan`. The storage items below give the same values as the local items of
 * earlier versions did, so their readers don't change. The demo keeps its plans in this browser
 * only (`local:demo.consultant…`), as before.
 */

/** Completed plans kept in the synced storage, newest first. */
export const SYNCED_COMPLETED_KEPT = 10;

/** Format version of the stored completed plans (the snapshot the item gives). */
export const COMPLETED_PLANS_VERSION = 1;

const VERSION = 1;
const PLAN = 'consultant.plan';
const DONE_INDEX = 'consultant.done';
const DONE = 'consultant.done.';
const LOCAL_PLAN = 'local:consultant.plan' as const;
const LOCAL_DONE = 'local:consultant.history' as const;

/** Which limit of the synced storage a plan exceeds: its own key's, or the storage's. */
export type PlanQuotaLimit = 'plan' | 'total';

/** A running plan that doesn't fit into the synced storage; nothing was written. */
export class PaintPlanQuotaError extends Error {
  constructor(readonly limit: PlanQuotaLimit) {
    super(`Paint plan doesn't fit into the synced storage (${limit})`);
    this.name = 'PaintPlanQuotaError';
  }
}

/** The message key for a plan that didn't fit, e.g. `consultant.planQuota.total`. */
export const planQuotaMessageKey = (limit: PlanQuotaLimit) =>
  `consultant.planQuota.${limit}` as const;

// ---- The compact formats ----

type Tier = [paints: number, percent: number];
const tierOf = (tier: PaintTier): Tier => [tier.paints, tier.percent];
const fromTier = (tier: unknown): PaintTier | undefined =>
  Array.isArray(tier) && typeof tier[0] === 'number' && typeof tier[1] === 'number'
    ? { paints: tier[0], percent: tier[1] }
    : undefined;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const numbers = (value: unknown): number[] => (Array.isArray(value) ? value.filter(isNumber) : []);
const pairs = (value: unknown): [number, number][] =>
  Array.isArray(value)
    ? value.filter(
        (pair): pair is [number, number] =>
          Array.isArray(pair) && isNumber(pair[0]) && isNumber(pair[1]),
      )
    : [];

/** An own paint as stored. */
interface SyncedOwn {
  i: number;
  t: string;
  s: number;
  v: number;
  p?: number;
  a?: number;
  f?: number;
  g?: 1;
}

/** The purchase as stored; `s`: [pledge id, SKU] of each pledge it bought. */
interface SyncedPurchase {
  o: string;
  b?: string;
  i: number[];
  f: number;
  n?: number;
  c?: number[];
  s?: [number, number][];
}

/** A running plan as stored. Times in ms, as the plan keeps them. */
export interface SyncedPlan {
  v: typeof VERSION;
  /** Way: buy first or melt first. */
  w: 'b' | 'm';
  a: number;
  c?: number;
  t: Tier;
  o: SyncedOwn[];
  /** Fillers: [SKU, name, quantity, price]. */
  f: [number, string, number, number][];
  k: number;
  p?: SyncedPurchase;
  /** Fillers melted: [pledge id, when]. */
  m?: [number, number][];
  r?: number;
  q?: Tier;
  e?: number;
  g?: 1;
}

export function encodePlan(plan: StoredRebuyPlan): SyncedPlan {
  const own = (paint: StoredOwnPaint): SyncedOwn => ({
    i: paint.pledgeId,
    t: paint.title,
    s: paint.skuId,
    v: paint.meltValue,
    ...(paint.price !== undefined && { p: paint.price }),
    ...(paint.meltedAt !== undefined && { a: paint.meltedAt }),
    ...(paint.freed !== undefined && { f: paint.freed }),
    ...(paint.seenGone && { g: 1 as const }),
  });
  const purchase = (bought: PlanPurchase): SyncedPurchase => ({
    o: bought.orderId,
    ...(bought.boughtAt !== undefined && { b: bought.boughtAt }),
    i: bought.pledgeIds,
    f: bought.foundAt,
    ...(bought.notifiedAt !== undefined && { n: bought.notifiedAt }),
    ...(bought.ownPledgeIds && { c: bought.ownPledgeIds }),
    ...(bought.skus && {
      s: Object.entries(bought.skus).map(([id, sku]): [number, number] => [Number(id), sku]),
    }),
  });
  return {
    v: VERSION,
    w: plan.way === 'melt' ? 'm' : 'b',
    a: plan.at,
    ...(plan.creditAtStart !== undefined && { c: plan.creditAtStart }),
    t: tierOf(plan.tier),
    o: plan.own.map(own),
    f: plan.fillers.map((filler) => [filler.skuId, filler.name, filler.quantity, filler.price]),
    k: plan.cartCost,
    ...(plan.purchase && { p: purchase(plan.purchase) }),
    ...(plan.fillersMelted && {
      m: Object.entries(plan.fillersMelted).map(([id, at]): [number, number] => [Number(id), at]),
    }),
    ...(plan.recalculatedAt !== undefined && { r: plan.recalculatedAt }),
    ...(plan.previousTier && { q: tierOf(plan.previousTier) }),
    ...(plan.checkEndedAt !== undefined && { e: plan.checkEndedAt }),
    ...(plan.migratedFrom === 1 && { g: 1 as const }),
  };
}

/** A stored running plan, checked; none of another format. */
export function decodePlan(stored: unknown): StoredRebuyPlan | undefined {
  const value = stored as Partial<SyncedPlan> | null | undefined;
  const tier = fromTier(value?.t);
  if (value?.v !== VERSION || !isNumber(value.a) || !tier || !isNumber(value.k)) return undefined;
  if (!Array.isArray(value.o) || !Array.isArray(value.f)) return undefined;
  const own = value.o.flatMap((paint): StoredOwnPaint[] =>
    paint &&
    isNumber(paint.i) &&
    typeof paint.t === 'string' &&
    isNumber(paint.s) &&
    isNumber(paint.v)
      ? [
          {
            pledgeId: paint.i,
            title: paint.t,
            skuId: paint.s,
            meltValue: paint.v,
            ...(isNumber(paint.p) && { price: paint.p }),
            ...(isNumber(paint.a) && { meltedAt: paint.a }),
            ...(isNumber(paint.f) && { freed: paint.f }),
            ...(paint.g === 1 && { seenGone: true }),
          },
        ]
      : [],
  );
  const fillers = value.f.flatMap((filler) =>
    Array.isArray(filler) &&
    isNumber(filler[0]) &&
    typeof filler[1] === 'string' &&
    isNumber(filler[2]) &&
    isNumber(filler[3])
      ? [{ skuId: filler[0], name: filler[1], quantity: filler[2], price: filler[3] }]
      : [],
  );
  const bought = value.p;
  const purchase: PlanPurchase | undefined =
    bought && typeof bought.o === 'string' && isNumber(bought.f)
      ? {
          orderId: bought.o,
          ...(typeof bought.b === 'string' && { boughtAt: bought.b }),
          pledgeIds: numbers(bought.i),
          foundAt: bought.f,
          ...(isNumber(bought.n) && { notifiedAt: bought.n }),
          ...(Array.isArray(bought.c) && { ownPledgeIds: numbers(bought.c) }),
          ...(Array.isArray(bought.s) && { skus: Object.fromEntries(pairs(bought.s)) }),
        }
      : undefined;
  const previousTier = fromTier(value.q);
  return {
    version: 2,
    way: value.w === 'm' ? 'melt' : 'buy',
    at: value.a,
    ...(isNumber(value.c) && { creditAtStart: value.c }),
    tier,
    own,
    fillers,
    cartCost: value.k,
    ...(purchase && { purchase }),
    ...(Array.isArray(value.m) && { fillersMelted: Object.fromEntries(pairs(value.m)) }),
    ...(isNumber(value.r) && { recalculatedAt: value.r }),
    ...(previousTier && { previousTier }),
    ...(isNumber(value.e) && { checkEndedAt: value.e }),
    ...(value.g === 1 && { migratedFrom: 1 as const }),
  };
}

/** A paint of a completed plan: [its name's index in `n`, SKU, count, value, filler 1/0]. */
type SyncedPaint = [name: number, skuId: number, count: number, value: number, filler: 0 | 1];

/** A completed plan as stored; each paint name once (`n`), the paints by its index. */
export interface SyncedCompleted {
  v: typeof VERSION;
  w: 'b' | 'm';
  s: number;
  e: number;
  t: Tier;
  o?: string;
  oc: number;
  fc: number;
  n: string[];
  m: SyncedPaint[];
  b: SyncedPaint[];
  fr: number;
  pd: number;
  r: number;
  cb?: number;
  ca?: number;
  mb: number;
  ma: number;
}

export function encodeCompleted(plan: CompletedPaintPlan): SyncedCompleted {
  const names: string[] = [];
  const paint = (entry: CompletedPaint): SyncedPaint => {
    let index = names.indexOf(entry.name);
    if (index < 0) index = names.push(entry.name) - 1;
    return [index, entry.skuId, entry.count, entry.value, entry.filler ? 1 : 0];
  };
  const melted = plan.melted.map(paint);
  const bought = plan.bought.map(paint);
  return {
    v: VERSION,
    w: plan.way === 'melt' ? 'm' : 'b',
    s: plan.startedAt,
    e: plan.completedAt,
    t: tierOf(plan.tier),
    ...(plan.orderId !== undefined && { o: plan.orderId }),
    oc: plan.ownCount,
    fc: plan.fillerCount,
    n: names,
    m: melted,
    b: bought,
    fr: plan.freed,
    pd: plan.paid,
    r: plan.result,
    ...(plan.creditBefore !== undefined && { cb: plan.creditBefore }),
    ...(plan.creditAfter !== undefined && { ca: plan.creditAfter }),
    mb: plan.meltBefore,
    ma: plan.meltAfter,
  };
}

/** A stored completed plan, checked; none of another format. */
export function decodeCompleted(stored: unknown): CompletedPaintPlan | undefined {
  const value = stored as Partial<SyncedCompleted> | null | undefined;
  const tier = fromTier(value?.t);
  if (value?.v !== VERSION || !tier || !isNumber(value.s) || !isNumber(value.e)) return undefined;
  const names = Array.isArray(value.n) ? value.n : [];
  const paints = (list: unknown): CompletedPaint[] =>
    Array.isArray(list)
      ? list.flatMap((entry): CompletedPaint[] => {
          if (!Array.isArray(entry)) return [];
          const [name, skuId, count, paid, filler] = entry as unknown[];
          const text = isNumber(name) ? names[name] : undefined;
          return typeof text === 'string' && isNumber(skuId) && isNumber(count) && isNumber(paid)
            ? [{ skuId, name: text, count, value: paid, filler: filler === 1 }]
            : [];
        })
      : [];
  const amount = (field: unknown) => (isNumber(field) ? field : 0);
  return {
    way: value.w === 'm' ? 'melt' : 'buy',
    startedAt: value.s,
    completedAt: value.e,
    tier,
    ...(typeof value.o === 'string' && { orderId: value.o }),
    ownCount: amount(value.oc),
    fillerCount: amount(value.fc),
    melted: paints(value.m),
    bought: paints(value.b),
    freed: amount(value.fr),
    paid: amount(value.pd),
    result: amount(value.r),
    ...(isNumber(value.cb) && { creditBefore: value.cb }),
    ...(isNumber(value.ca) && { creditAfter: value.ca }),
    meltBefore: amount(value.mb),
    meltAfter: amount(value.ma),
  };
}

/** A completed plan's key: its start (base 36) and its way – what tells two plans apart. */
export const completedIdOf = (plan: Pick<CompletedPaintPlan, 'startedAt' | 'way'>) =>
  `${plan.startedAt.toString(36)}${plan.way === 'melt' ? 'm' : 'b'}`;

/**
 * The completed plans of both, each once (by `completedIdOf`, the first one given wins), newest
 * first.
 */
export function mergeCompleted(...lists: (readonly CompletedPaintPlan[])[]): CompletedPaintPlan[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((plan) => {
      const id = completedIdOf(plan);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => b.completedAt - a.completedAt);
}

// ---- Measuring ----

type Stored = Record<string, unknown>;

/** Whether everything in `stored` fits, with `written` keys checked against the limit per key. */
export function fitsSynced(stored: Readonly<Stored>, written: readonly string[] = []): boolean {
  if (written.some((key) => bytesOf(key, stored[key]) > SYNC_QUOTA.perItem)) return false;
  const entries = Object.entries(stored).filter(([, value]) => value !== undefined);
  const total = entries.reduce((sum, [key, value]) => sum + bytesOf(key, value), 0);
  return total <= SYNC_QUOTA.total && entries.length <= SYNC_QUOTA.maxItems;
}

/** The ids of the completed plans in the order stored (newest first). */
function indexOf(stored: Readonly<Stored>): string[] {
  const index = stored[DONE_INDEX] as { v?: unknown; ids?: unknown } | undefined;
  return index?.v === VERSION && Array.isArray(index.ids)
    ? index.ids.filter((id): id is string => typeof id === 'string')
    : [];
}

/** Without the completed plans: the index and every key of one. */
const withoutCompleted = (stored: Readonly<Stored>): Stored =>
  Object.fromEntries(
    Object.entries(stored).filter(([key]) => key !== DONE_INDEX && !key.startsWith(DONE)),
  );

/**
 * Which completed plans go into the synced storage (`stored`, everything there now) and which
 * stay local: the newest `SYNCED_COMPLETED_KEPT` that fit, next to everything else stored.
 */
export function planCompleted(
  stored: Readonly<Stored>,
  plans: readonly CompletedPaintPlan[],
): { writes: Stored; removed: string[]; leftover: CompletedPaintPlan[] } {
  const base = withoutCompleted(stored);
  const kept: { id: string; value: SyncedCompleted }[] = [];
  const leftover: CompletedPaintPlan[] = [];
  for (const plan of mergeCompleted(plans)) {
    if (kept.length >= SYNCED_COMPLETED_KEPT) {
      leftover.push(plan);
      continue;
    }
    const next = [...kept, { id: completedIdOf(plan), value: encodeCompleted(plan) }];
    const candidate = { ...base, ...completedEntries(next) };
    if (fitsSynced(candidate, Object.keys(completedEntries(next)))) kept.push(next.at(-1)!);
    else leftover.push(plan);
  }
  const writes = completedEntries(kept);
  const removed = Object.keys(stored).filter(
    (key) => (key === DONE_INDEX || key.startsWith(DONE)) && !(key in writes),
  );
  return { writes, removed, leftover };
}

function completedEntries(kept: readonly { id: string; value: SyncedCompleted }[]): Stored {
  if (!kept.length) return {};
  return {
    [DONE_INDEX]: { v: VERSION, ids: kept.map(({ id }) => id) },
    ...Object.fromEntries(kept.map(({ id, value }) => [`${DONE}${id}`, value])),
  };
}

/**
 * Where the running plan goes into the synced storage (`stored`): its key, and the completed
 * plans that give way for it, oldest first; `undefined` if it doesn't fit even without them.
 */
export function planRunning(
  stored: Readonly<Stored>,
  value: SyncedPlan,
): { gaveWay: string[]; index: string[] } | PlanQuotaLimit {
  if (bytesOf(PLAN, value) > SYNC_QUOTA.perItem) return 'plan';
  const ids = indexOf(stored);
  const candidate: Stored = { ...stored, [PLAN]: value };
  const gaveWay: string[] = [];
  while (!fitsSynced(candidate) && ids.length) {
    const id = ids.pop()!;
    gaveWay.push(id);
    delete candidate[`${DONE}${id}`];
    if (ids.length) candidate[DONE_INDEX] = { v: VERSION, ids: [...ids] };
    else delete candidate[DONE_INDEX];
  }
  return fitsSynced(candidate) ? { gaveWay, index: ids } : 'total';
}

// ---- Reading and writing ----

const sync = () => browser.storage.sync;

/** The browser's own quota error, e.g. when another device wrote meanwhile. */
const isQuotaError = (error: unknown) =>
  error instanceof Error && /quota|MAX_ITEMS|MAX_WRITE/i.test(error.message);

async function localCompleted(): Promise<CompletedPaintPlan[]> {
  const local = await storage.getItem<CompletedPlansSnapshot>(LOCAL_DONE);
  return local?.version === COMPLETED_PLANS_VERSION && Array.isArray(local.plans)
    ? local.plans
    : [];
}

async function setLocalCompleted(plans: readonly CompletedPaintPlan[]): Promise<void> {
  if (plans.length) {
    await storage.setItem(LOCAL_DONE, { version: COMPLETED_PLANS_VERSION, plans: [...plans] });
  } else {
    await storage.removeItem(LOCAL_DONE);
  }
}

/** The running plan: the synced one, else one left in this browser. */
export async function loadPlan(): Promise<AnyStoredRebuyPlan | null> {
  const stored = await sync().get(PLAN);
  const plan = decodePlan(stored[PLAN]);
  if (plan) return plan;
  return (await storage.getItem<AnyStoredRebuyPlan>(LOCAL_PLAN)) ?? null;
}

/**
 * Stores the running plan (`null` removes it). Throws a `PaintPlanQuotaError` if it doesn't fit
 * even after the completed plans gave way; then nothing is written. A plan of the first format
 * stays in this browser.
 */
export async function savePlan(plan: AnyStoredRebuyPlan | null): Promise<void> {
  if (!plan) {
    await sync().remove(PLAN);
    await storage.removeItem(LOCAL_PLAN);
    return;
  }
  if (plan.version !== 2) {
    await storage.setItem(LOCAL_PLAN, plan);
    return;
  }
  const value = encodePlan(plan);
  const stored = await sync().get(null);
  const placed = planRunning(stored, value);
  if (typeof placed === 'string') throw new PaintPlanQuotaError(placed);
  if (placed.gaveWay.length) {
    // Completed plans that give way stay in this browser, before they leave the synced storage.
    const moved = placed.gaveWay.flatMap((id) => decodeCompleted(stored[`${DONE}${id}`]) ?? []);
    await setLocalCompleted(mergeCompleted(await localCompleted(), moved));
    await sync().remove(placed.gaveWay.map((id) => `${DONE}${id}`));
    if (placed.index.length) await sync().set({ [DONE_INDEX]: { v: VERSION, ids: placed.index } });
    else await sync().remove(DONE_INDEX);
  }
  try {
    await sync().set({ [PLAN]: value });
  } catch (error) {
    if (isQuotaError(error)) throw new PaintPlanQuotaError('total');
    throw error;
  }
  await storage.removeItem(LOCAL_PLAN);
}

/** Every completed plan: the synced ones and those left in this browser, newest first. */
export async function loadCompleted(): Promise<CompletedPaintPlan[]> {
  const stored = await sync().get(null);
  const synced = indexOf(stored).flatMap((id) => decodeCompleted(stored[`${DONE}${id}`]) ?? []);
  return mergeCompleted(synced, await localCompleted());
}

/**
 * Stores the completed plans: the newest that fit into the synced storage, the others in this
 * browser. Never fails for want of room: if the synced storage refuses them, all stay local.
 */
export async function saveCompleted(plans: readonly CompletedPaintPlan[]): Promise<void> {
  const stored = await sync().get(null);
  const { writes, removed, leftover } = planCompleted(stored, plans);
  // Only what changed: the synced storage allows few writes per minute.
  const changed = Object.fromEntries(
    Object.entries(writes).filter(
      ([key, value]) => JSON.stringify(stored[key]) !== JSON.stringify(value),
    ),
  );
  try {
    if (Object.keys(changed).length) await sync().set(changed);
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    await setLocalCompleted(mergeCompleted(plans));
    return;
  }
  await setLocalCompleted(leftover);
  if (removed.length) await sync().remove(removed);
}

/** Calls `callback` when one of the given keys changes, also on another device. */
function watchKeys(ours: (key: string, area: string) => boolean, callback: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (Object.keys(changes).some((key) => ours(key, area))) callback();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** The running plan as a storage item, as the local one of earlier versions was. */
export const syncedPlanItem = {
  key: `sync:${PLAN}`,
  getValue: loadPlan,
  setValue: savePlan,
  removeValue: () => savePlan(null),
  watch: (callback: (value: AnyStoredRebuyPlan | null) => void) =>
    watchKeys(
      (key, area) =>
        (area === 'sync' && key === PLAN) || (area === 'local' && key === 'consultant.plan'),
      () => void loadPlan().then(callback),
    ),
};

const snapshotOf = (plans: CompletedPaintPlan[]): CompletedPlansSnapshot => ({
  version: COMPLETED_PLANS_VERSION,
  plans,
});

/** The completed plans as a storage item, as the local one of earlier versions was. */
export const syncedCompletedItem = {
  key: `sync:${DONE_INDEX}`,
  getValue: async () => snapshotOf(await loadCompleted()),
  setValue: (snapshot: CompletedPlansSnapshot | null) => saveCompleted(snapshot?.plans ?? []),
  removeValue: () => saveCompleted([]),
  watch: (callback: (value: CompletedPlansSnapshot) => void) =>
    watchKeys(
      (key, area) =>
        (area === 'sync' && (key === DONE_INDEX || key.startsWith(DONE))) ||
        (area === 'local' && key === 'consultant.history'),
      () => void loadCompleted().then((plans) => callback(snapshotOf(plans))),
    ),
};

// ---- Moving the plans of earlier versions (#635) ----

/**
 * Moves a plan and completed plans kept in this browser by earlier versions to the synced
 * storage, on the first start after the update; later starts do nothing. Nothing is lost:
 * - the running plan: if another device synced one already, the newer one (by its start) wins;
 * - the completed plans are merged with the synced ones by their start;
 * - what doesn't fit stays in this browser and is still shown.
 */
export async function migratePaintPlans(): Promise<void> {
  const local = await storage.getItem<AnyStoredRebuyPlan>(LOCAL_PLAN);
  if (local?.version === 2) {
    const synced = decodePlan((await sync().get(PLAN))[PLAN]);
    if (synced && synced.at >= local.at) await storage.removeItem(LOCAL_PLAN);
    else {
      try {
        await savePlan(local);
      } catch (error) {
        // It doesn't fit: it stays in this browser and is still shown.
        if (!(error instanceof PaintPlanQuotaError)) throw error;
      }
    }
  }

  const leftover = await localCompleted();
  if (!leftover.length) return;
  const stored = await sync().get(null);
  const synced = indexOf(stored).flatMap((id) => decodeCompleted(stored[`${DONE}${id}`]) ?? []);
  // Done before: what is left here is older than the synced ones, or didn't fit.
  const next = planCompleted(stored, mergeCompleted(synced, leftover));
  const moves =
    next.leftover.length !== leftover.length ||
    Object.keys(next.writes).some((key) => key !== DONE_INDEX && !(key in stored));
  if (moves) await saveCompleted(mergeCompleted(synced, leftover));
}

/** The keys of the plans in the synced storage, for the settings' "Stored data" (#560). */
export const isPlanKey = (key: string) => key === PLAN;
export const isCompletedKey = (key: string) => key === DONE_INDEX || key.startsWith(DONE);

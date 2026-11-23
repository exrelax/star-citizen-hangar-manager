import { onScopeDispose, ref, watch, type Ref } from 'vue';
import type { CompletedPlansSnapshot } from '@/store/paint-consultant/completed-plans';
import { currentPlanOf } from '@/store/paint-consultant/rebuy-plan-storage';
import { encodePlan, planCompleted } from '@/store/paint-consultant/synced-plans';
import { measureSynced, syncedIdOf, type SyncedUsage } from './synced-usage';

/*
 * The use of the synced storage (#560), measured again whenever it changes – also on another
 * device. In the demo mode the demo's own watchlists, marks and paint plans instead, which are kept
 * in this browser under `demo.` (never the account's): the plans as they would be synced (#635).
 */

const DEMO_PREFIX = 'demo.';

/** The demo's paint plans, kept as the local items of earlier versions were. */
const DEMO_PLAN = `${DEMO_PREFIX}consultantPlan`;
const DEMO_HISTORY = `${DEMO_PREFIX}consultantHistory`;

/** A key of the demo's own synced data, without its prefix. */
const demoName = (key: string) =>
  key === DEMO_PLAN || key === DEMO_HISTORY
    ? key
    : key.startsWith(DEMO_PREFIX) && syncedIdOf(key.slice(DEMO_PREFIX.length))
      ? key.slice(DEMO_PREFIX.length)
      : undefined;

/** The demo's paint plans as they would be stored in the synced storage. */
function demoPlans(plan: unknown, history: unknown): Record<string, unknown> {
  const running = currentPlanOf(plan);
  const completed = (history as CompletedPlansSnapshot | null | undefined)?.plans ?? [];
  return {
    ...(running && { 'consultant.plan': encodePlan(running) }),
    ...planCompleted({}, completed).writes,
  };
}

/**
 * Reads what is stored: the synced storage, or the demo's own keys without their prefix – by the
 * order of its watchlists, so the local storage with the hangar (a few MB) isn't read as a whole.
 */
async function readStored(demo: boolean): Promise<Record<string, unknown>> {
  if (!demo) return browser.storage.sync.get(null);
  const head = await browser.storage.local.get([
    `${DEMO_PREFIX}watchlists`,
    `${DEMO_PREFIX}hangar.meltMarks`,
  ]);
  const plans = await browser.storage.local.get([DEMO_PLAN, DEMO_HISTORY]);
  const index = head[`${DEMO_PREFIX}watchlists`] as { ids?: unknown } | undefined;
  const ids = Array.isArray(index?.ids) ? index.ids.filter((id) => typeof id === 'string') : [];
  const lists = ids.length
    ? await browser.storage.local.get(ids.map((id) => `${DEMO_PREFIX}watchlist.${id}`))
    : {};
  return {
    ...Object.fromEntries(
      Object.entries({ ...head, ...lists }).map(([key, value]) => [
        key.slice(DEMO_PREFIX.length),
        value,
      ]),
    ),
    ...demoPlans(plans[DEMO_PLAN], plans[DEMO_HISTORY]),
  };
}

export function useSyncedUsage(demo: Readonly<Ref<boolean>>): Ref<SyncedUsage | undefined> {
  const usage = ref<SyncedUsage>();
  let run = 0;
  const measure = async () => {
    const current = ++run;
    const stored = await readStored(demo.value).catch(() => undefined);
    // Only the newest reading counts, e.g. right after the demo mode was turned on.
    if (current === run) usage.value = stored ? measureSynced(stored) : undefined;
  };
  watch(demo, () => void measure(), { immediate: true });

  const listener = (changes: Record<string, unknown>, area: string) => {
    if (demo.value ? area === 'local' && Object.keys(changes).some(demoName) : area === 'sync') {
      void measure();
    }
  };
  browser.storage.onChanged.addListener(listener);
  onScopeDispose(() => browser.storage.onChanged.removeListener(listener));
  return usage;
}

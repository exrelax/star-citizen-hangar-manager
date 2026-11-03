import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { computed, inject, onMounted, shallowRef, type InjectionKey, type Ref } from 'vue';
import { createFakeIds, demoBuyback, demoHangar } from './demo';

/** Random key of the demo, created on first use and kept only in this browser. */
const demoKeyItem = storage.defineItem<string | null>('local:demo.key', { fallback: null });

async function demoKey(): Promise<string> {
  let key = await demoKeyItem.getValue();
  if (!key) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    key = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    await demoKeyItem.setValue(key);
  }
  return key;
}

/** What the rows need to know in the demo; `null` outside of it. */
export interface DemoContext {
  /** Made-up id for a real pledge id, e.g. of an applied CCU. */
  fakeId: (id: number) => string;
}

export const DEMO_CONTEXT: InjectionKey<Ref<DemoContext | null>> = Symbol('shm-demo');

/** The demo context provided by the manager view (`null` outside the demo). */
export function useDemoContext(): Ref<DemoContext | null> {
  return inject(DEMO_CONTEXT, shallowRef(null));
}

/**
 * The demo variants of the lists, built from the real ones while `active` (the demo mode
 * setting; the selection is only computed when it is on).
 */
export function useDemo(
  active: Readonly<Ref<boolean>>,
  pledges: Ref<PledgeView[]>,
  buyback: Ref<BuybackView[]>,
) {
  const key = shallowRef<string>();
  onMounted(async () => (key.value = await demoKey()));

  const ready = computed(() => !active.value || key.value !== undefined);
  const context = computed<DemoContext | null>(() =>
    active.value && key.value ? { fakeId: createFakeIds(key.value) } : null,
  );
  const demoPledges = computed(() => (key.value ? demoHangar(pledges.value, key.value) : []));
  const demoBuybackPledges = computed(() =>
    key.value ? demoBuyback(buyback.value, key.value) : [],
  );
  return {
    ready,
    context,
    pledges: computed(() => (active.value ? demoPledges.value : pledges.value)),
    buyback: computed(() => (active.value ? demoBuybackPledges.value : buyback.value)),
  };
}

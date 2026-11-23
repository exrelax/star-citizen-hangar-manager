import { i18n } from '@/i18n';
import { ref } from 'vue';
import type { PlanItem, StoredRebuyPlan } from './rebuy-plan-storage';
import { PaintPlanQuotaError, planQuotaMessageKey } from './synced-plans';

/*
 * Keeps a plan that starts (#317) – in the synced storage since #635, which may be full. A plan
 * that doesn't fit isn't started: the message says why, next to the button that started it
 * (`PaintStartButton`), and nothing else changes.
 */

/** Why the last start failed, for the button that asked for it (`by`). */
export const planStartError = ref<{ by: string; message: string }>();
/** The button that started a plan last. */
export const planStartedBy = ref<string>();

/** Keeps the started plan; `false` if it doesn't fit, with the message in `planStartError`. */
export async function keepStartedPlan(item: PlanItem, plan: StoredRebuyPlan): Promise<boolean> {
  const by = planStartedBy.value ?? '';
  planStartError.value = undefined;
  try {
    await item.setValue(plan);
    return true;
  } catch (error) {
    if (!(error instanceof PaintPlanQuotaError)) throw error;
    planStartError.value = { by, message: i18n.t(planQuotaMessageKey(error.limit)) };
    return false;
  }
}

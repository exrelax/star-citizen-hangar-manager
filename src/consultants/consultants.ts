import { openTabAt } from '@/hangar/open-tab-at';
import { ref } from 'vue';

/*
 * The consultants of the tab "Consultants" (#113, #453): the CCU Consultant and the Paint Discount
 * Consultant, each shown only while it has something to show – the CCU Consultant while the hangar
 * has CCUs, the Paint Discount Consultant while paints can be bought again for less (a new plan), a
 * plan runs or there are completed plans to look back on. With more than one, sub tabs choose
 * between them; with one, its name is the heading. With none, the CCU Consultant says why.
 */

export const CONSULTANTS = ['ccu', 'paint'] as const;
export type ConsultantId = (typeof CONSULTANTS)[number];

/** The consultants to show, in their order; the CCU Consultant if none has anything. */
export function consultantsOf(has: Record<ConsultantId, boolean>): ConsultantId[] {
  const shown = CONSULTANTS.filter((id) => has[id]);
  return shown.length ? shown : ['ccu'];
}

/** The consultant shown: the chosen one while it is there, else the first one. */
export function shownConsultantOf(
  shown: readonly ConsultantId[],
  chosen: ConsultantId | undefined,
): ConsultantId {
  return chosen && shown.includes(chosen) ? chosen : shown[0]!;
}

/** The last request to show a consultant (a sidebar box, a link); `at` tells repeated ones apart. */
export const consultantRequest = ref<{ id: ConsultantId; at: number }>();

/** The top of the tab "Consultants", where a link to a consultant scrolls to. */
export const CONSULTANTS_TOP_ID = 'shm-consultants-top';

/** Switches to the tab "Consultants" with `id` shown, and scrolls to its top. */
export function openConsultant(id: ConsultantId, { highlight = false } = {}): void {
  consultantRequest.value = { id, at: Date.now() };
  openTabAt('consultants', CONSULTANTS_TOP_ID, { highlight });
}

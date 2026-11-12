import { openTabAt } from '@/hangar/open-tab-at';
import { ref } from 'vue';

/*
 * The Paint Discount Consultant's tabs (#244): the running plan, a new plan and the completed
 * plans. Each one shows only with something in it; with a single one there are no tabs, only its
 * heading.
 */

export const CONSULTANT_TABS = ['running', 'new', 'completed'] as const;
export type ConsultantTab = (typeof CONSULTANT_TABS)[number];

/** The tabs with something to show, in their order. */
export function consultantTabsOf(has: Record<ConsultantTab, boolean>): ConsultantTab[] {
  return CONSULTANT_TABS.filter((tab) => has[tab]);
}

/**
 * The tab shown: the chosen one while it is there, else the first one – the running plan while it
 * has steps left, then a new plan.
 */
export function shownTabOf(
  tabs: readonly ConsultantTab[],
  chosen: ConsultantTab | undefined,
): ConsultantTab | undefined {
  return chosen && tabs.includes(chosen) ? chosen : tabs[0];
}

/** The last request to show a tab (e.g. from the sidebar's box); `at` tells repeated ones apart. */
export const consultantTabRequest = ref<{ tab: ConsultantTab; at: number }>();

/**
 * Shows the consultant: switches to the Pledge Store tab and scrolls to it, with the given part
 * selected if it is there.
 */
export function openPaintConsultant(tab?: ConsultantTab): void {
  if (tab) consultantTabRequest.value = { tab, at: Date.now() };
  openTabAt('store', 'shm-consultant-title');
}

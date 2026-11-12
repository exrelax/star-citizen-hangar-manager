import { watch } from 'vue';
import { actionFromSearch, ACTION_PARAM, type ManagerAction } from './manager-action-message';
import { hashOfTab } from './route';
import { selection } from './selection';
import { meltReadyIds } from './use-melt-marks';
import { showHangarFilter } from './view-filter';
import { showBuybackFilter } from '@/buyback/buyback-filter-request';
import { openCurrentWarbonds } from '@/store/open-current-warbonds';

export {
  isManagerActionMessage,
  type ManagerAction,
  type ManagerActionMessage,
} from './manager-action-message';

/*
 * What a click on a browser notification asks the Hangar Manager to do (#154): open it, show only
 * the marked pledges that can be melted now, or select them – like the sidebar's "Show" and
 * "Select" –, or show the buy back's pledges whose price is expected to rise (#193). The background script sends it to an open RSI tab as a message, or opens the manager
 * with it in the URL (`?shm-action=…`), which the content script reads once and removes.
 */

/** Takes the action out of the page's URL, so a reload doesn't repeat it. */
export function takeActionFromUrl(): ManagerAction | undefined {
  const action = actionFromSearch(location.search);
  if (!action) return undefined;
  const url = new URL(location.href);
  url.searchParams.delete(ACTION_PARAM);
  history.replaceState(history.state, '', url.href);
  return action;
}

/** How long a fresh page may take to know the pledges that can be melted now. */
const READY_WAIT_MS = 15_000;

/** The ids of the marked pledges that can be melted now, once known (none after a while). */
function meltReadyWhenKnown(): Promise<ReadonlySet<number>> {
  if (meltReadyIds.value.size) return Promise.resolve(meltReadyIds.value);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      stop();
      resolve(meltReadyIds.value);
    }, READY_WAIT_MS);
    const stop = watch(meltReadyIds, (ids) => {
      if (!ids.size) return;
      clearTimeout(timeout);
      stop();
      resolve(ids);
    });
  });
}

/** Shows My Hangar in the manager and does what the action asks. */
export async function applyManagerAction(action: ManagerAction): Promise<void> {
  // New warbond CCUs (#164): the Pledge Store tab at its warbond CCUs.
  if (action === 'showWarbonds') {
    openCurrentWarbonds();
    return;
  }
  // Expected price increases (#193): the buy back with its filter "Price increase expected".
  if (action === 'showPriceIncreases') {
    showBuybackFilter('priceIncrease');
    return;
  }
  location.hash = hashOfTab('hangar');
  if (action === 'open') return;
  // A tab opened just now reads its lists first: the filter and the selection need them.
  const ready = await meltReadyWhenKnown();
  if (!ready.size) return;
  if (action === 'showMeltReady') showHangarFilter('meltReady');
  else selection.replace(ready);
}

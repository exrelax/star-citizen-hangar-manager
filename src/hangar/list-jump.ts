import { shallowRef } from 'vue';
import type { FilterState } from './filters';
import { hashOfTab, urlWithSearch } from './route';

/*
 * Opening a pledge in a list of the manager from somewhere else in it (#436), e.g. an entry under
 * "Base ship" of a CCU row: "My Hangar" or "Buy Back" searches for the pledge's id. The way there
 * is an entry of the browser's history, so Back returns to the list as it was – its tab, search
 * and filters, with the CCU row expanded again and its "Base ship" section open – and Forward goes
 * to the pledge again. Each history entry keeps its view in `history.state`.
 */

export type ListTab = 'hangar' | 'buyback';

/** A view of a list, as a history entry keeps it. */
export interface ListView {
  tab: ListTab;
  search: string;
  /** The filter buttons' states; none for a pledge opened by its id. */
  filters?: [string, FilterState][];
  /** The CCU row to expand again, with its "Base ship" section open (its pledge id). */
  expand?: number;
}

/** The key of the view in `history.state`, beside what RSI's page keeps there. */
const STATE_KEY = 'shmListView';

/**
 * The view to show now, each request (`at`) once; read by the app, the lists and the rows. `top`:
 * scroll to the list's top, for an opened pledge (a view coming back scrolls to its row).
 */
export const listViewRequest = shallowRef<(ListView & { at: number; top?: boolean }) | null>(null);

const show = (view: ListView) =>
  (listViewRequest.value = {
    ...view,
    at: Date.now(),
    ...(view.expand === undefined && { top: true }),
  });

/** The view kept in a history entry's state, if it is one of a list. */
export function viewOfState(state: unknown): ListView | undefined {
  const view = (state as Record<string, unknown> | null)?.[STATE_KEY] as ListView | undefined;
  return view &&
    (view.tab === 'hangar' || view.tab === 'buyback') &&
    typeof view.search === 'string'
    ? view
    : undefined;
}

/** The URL of a view: the page with its search and the tab's hash. */
export function urlOfView(href: string, view: Pick<ListView, 'tab' | 'search'>): string {
  const url = new URL(urlWithSearch(href, view.search));
  url.hash = hashOfTab(view.tab);
  return url.href;
}

/**
 * Shows the pledge in its list, searched by its id (`term`: the id the list finds it by, in the
 * demo its made-up one). `from` is the view to come back to with Back.
 */
export function openPledgeInList(tab: ListTab, term: string, from: ListView): void {
  const target: ListView = { tab, search: term };
  history.replaceState({ ...(history.state ?? {}), [STATE_KEY]: from }, '', location.href);
  history.pushState({ [STATE_KEY]: target }, '', urlOfView(location.href, target));
  show(target);
}

/** Back and Forward between such entries show their view again; returns the stop function. */
export function followListHistory(): () => void {
  const onPopState = (event: PopStateEvent) => {
    const view = viewOfState(event.state);
    if (view) show(view);
  };
  addEventListener('popstate', onPopState);
  return () => removeEventListener('popstate', onPopState);
}

/** The row to expand of the request, once: the row and its section take it on mounting. */
export function takeExpand(pledgeId: number, part: 'row' | 'coverage'): boolean {
  const request = listViewRequest.value;
  if (request?.expand !== pledgeId) return false;
  // The row opens first, then its section, which ends the request's part.
  if (part === 'coverage') listViewRequest.value = { ...request, expand: undefined };
  return true;
}

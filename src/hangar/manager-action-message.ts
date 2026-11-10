/*
 * What a click on a browser notification asks the Hangar Manager to do (#154), shared by the
 * background script (which sends it) and the content script (which does it, see
 * `manager-action.ts`). Kept free of the manager's code, so the background doesn't load it.
 */

export const MANAGER_ACTIONS = [
  'open',
  'showMeltReady',
  'selectMeltReady',
  'showWarbonds',
  'showPriceIncreases',
] as const;
export type ManagerAction = (typeof MANAGER_ACTIONS)[number];

/** The message to a tab with the content script. */
export interface ManagerActionMessage {
  type: 'shm:manager-action';
  action: ManagerAction;
}

export const isManagerActionMessage = (message: unknown): message is ManagerActionMessage =>
  typeof message === 'object' &&
  message !== null &&
  (message as ManagerActionMessage).type === 'shm:manager-action' &&
  MANAGER_ACTIONS.includes((message as ManagerActionMessage).action);

/** The URL parameter that carries the action into a tab opened for it. */
export const ACTION_PARAM = 'shm-action';

/** The action in a URL's query, if any. */
export function actionFromSearch(search: string): ManagerAction | undefined {
  const action = new URLSearchParams(search).get(ACTION_PARAM);
  return MANAGER_ACTIONS.find((known) => known === action);
}

/**
 * The message of the content script whenever the Hangar Manager is shown in a visible tab: its
 * sidebar tells what the browser notifications tell, so they can go (#155).
 */
export const MANAGER_SEEN = 'shm:manager-seen';

// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { actionFromSearch, isManagerActionMessage } from './manager-action-message';
import { applyManagerAction, takeActionFromUrl } from './manager-action';
import { selection } from './selection';
import { meltReadyIds } from './use-melt-marks';
import { hangarViewFilter } from './view-filter';

beforeEach(() => {
  selection.clear();
  hangarViewFilter.value = null;
  meltReadyIds.value = new Set();
});

describe('actions in the URL and in messages', () => {
  it('knows only its own actions', () => {
    expect(actionFromSearch('?shm-action=showMeltReady')).toBe('showMeltReady');
    expect(actionFromSearch('?shm-action=melt')).toBeUndefined();
    expect(isManagerActionMessage({ type: 'shm:manager-action', action: 'open' })).toBe(true);
    expect(isManagerActionMessage({ type: 'shm:manager-action', action: 'melt' })).toBe(false);
  });

  it('takes the action out of the URL once', () => {
    history.replaceState(null, '', '/en/account/pledges?shm-action=selectMeltReady#hangar-manager');
    expect(takeActionFromUrl()).toBe('selectMeltReady');
    expect(location.search).toBe('');
    expect(location.hash).toBe('#hangar-manager');
    expect(takeActionFromUrl()).toBeUndefined();
  });
});

describe('applyManagerAction', () => {
  it('selects the pledges that can be melted now, once they are known', async () => {
    const applied = applyManagerAction('selectMeltReady');
    meltReadyIds.value = new Set([1, 2]);
    await applied;
    expect([...selection.ids.value]).toEqual([1, 2]);
    expect(location.hash).toBe('#hangar-manager');
  });

  it('shows only them', async () => {
    meltReadyIds.value = new Set([1]);
    await applyManagerAction('showMeltReady');
    expect(hangarViewFilter.value?.id).toBe('meltReady');
  });
});

describe('showWarbonds', () => {
  it('opens the Pledge Store tab', async () => {
    await applyManagerAction('showWarbonds');
    expect(location.hash).toBe('#hangar-manager-store');
  });
});

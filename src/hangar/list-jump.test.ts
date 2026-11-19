// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import {
  followListHistory,
  listViewRequest,
  openPledgeInList,
  takeExpand,
  urlOfView,
  viewOfState,
} from './list-jump';

afterEach(() => {
  listViewRequest.value = null;
});

describe('list jumps (#436)', () => {
  it('builds the URL of a view with its search and tab', () => {
    const href = 'https://robertsspaceindustries.com/en/account/pledges?search=old#hangar-manager';
    expect(urlOfView(href, { tab: 'buyback', search: '123' })).toBe(
      'https://robertsspaceindustries.com/en/account/pledges?search=123#hangar-manager-bb',
    );
  });

  it('reads only views of a list from a history state', () => {
    expect(viewOfState({ shmListView: { tab: 'hangar', search: '' } })).toEqual({
      tab: 'hangar',
      search: '',
    });
    expect(viewOfState({ shmListView: { tab: 'store', search: '' } })).toBeUndefined();
    expect(viewOfState(null)).toBeUndefined();
  });

  it('keeps the view to come back to and shows the pledge, then Back shows the view again', () => {
    const stop = followListHistory();
    const from = { tab: 'hangar' as const, search: 'titan', filters: [], expand: 42 };
    openPledgeInList('buyback', '123', from);
    expect(listViewRequest.value).toMatchObject({ tab: 'buyback', search: '123' });
    expect(viewOfState(history.state)).toEqual({ tab: 'buyback', search: '123' });
    expect(location.hash).toBe('#hangar-manager-bb');

    dispatchEvent(new PopStateEvent('popstate', { state: { shmListView: from } }));
    expect(listViewRequest.value).toMatchObject(from);
    stop();
  });

  it('expands the row, then its section, once', () => {
    listViewRequest.value = { tab: 'hangar', search: '', expand: 42, at: 1 };
    expect(takeExpand(7, 'row')).toBe(false);
    expect(takeExpand(42, 'row')).toBe(true);
    expect(takeExpand(42, 'coverage')).toBe(true);
    expect(takeExpand(42, 'row')).toBe(false);
  });
});

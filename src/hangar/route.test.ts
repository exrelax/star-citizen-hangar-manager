import { describe, expect, it } from 'vitest';
import { isHangarPath, isManagerRoute, managerHref, searchFromUrl, urlWithSearch } from './route';

describe('isHangarPath', () => {
  it.each(['/account/pledges', '/en/account/pledges', '/de-de/account/pledges/'])(
    'accepts %s',
    (path) => expect(isHangarPath(path)).toBe(true),
  );

  it.each(['/account/roms', '/en/account/buy-back-pledges', '/pledge', '/en/account/pledges/x'])(
    'rejects %s',
    (path) => expect(isHangarPath(path)).toBe(false),
  );
});

describe('isManagerRoute', () => {
  it('matches only the manager hash', () => {
    expect(isManagerRoute('#hangar-manager')).toBe(true);
    expect(isManagerRoute('')).toBe(false);
    expect(isManagerRoute('#other')).toBe(false);
  });
});

describe('managerHref', () => {
  it('appends the manager hash and replaces an existing one', () => {
    expect(managerHref('/account/pledges')).toBe('/account/pledges#hangar-manager');
    expect(managerHref('/en/account/pledges#top')).toBe('/en/account/pledges#hangar-manager');
  });
});

describe('searchFromUrl', () => {
  it('reads the search term, also with + or %20 for spaces', () => {
    expect(searchFromUrl('?search=polaris')).toBe('polaris');
    expect(searchFromUrl('?page=2&search=f8c+lightning')).toBe('f8c lightning');
    expect(searchFromUrl('?search=f8c%20lightning%20')).toBe('f8c lightning');
  });

  it('is empty without the parameter', () => {
    expect(searchFromUrl('')).toBe('');
    expect(searchFromUrl('?page=2')).toBe('');
  });
});

describe('urlWithSearch', () => {
  const base = 'https://robertsspaceindustries.com/en/account/pledges';

  it('sets the term and keeps other parameters and the hash', () => {
    expect(urlWithSearch(`${base}?page=2#hangar-manager`, ' f8c lightning ')).toBe(
      `${base}?page=2&search=f8c+lightning#hangar-manager`,
    );
  });

  it('replaces an existing term and removes it when empty', () => {
    expect(urlWithSearch(`${base}?search=old#hangar-manager`, 'polaris')).toBe(
      `${base}?search=polaris#hangar-manager`,
    );
    expect(urlWithSearch(`${base}?search=old#hangar-manager`, '  ')).toBe(`${base}#hangar-manager`);
  });
});

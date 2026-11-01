import { describe, expect, it } from 'vitest';
import { isHangarPath, isManagerRoute, managerHref } from './route';

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

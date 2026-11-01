// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createNavItem, findAccountNav, findHangarLink, setActiveItem } from './account-nav';

beforeEach(() => {
  document.body.innerHTML = `
    <div class="sidenav">
      <ul>
        <li class="active"><a href="/account/pledges"><span class="bg">My Gear</span></a></li>
        <li><a href="/account/roms"><span class="bg">My ROMs</span></a></li>
      </ul>
    </div>`;
});

describe('findAccountNav', () => {
  it('finds the list that links to the hangar', () => {
    const nav = findAccountNav(document);
    expect(nav).not.toBeNull();
    expect(findHangarLink(nav!)?.getAttribute('href')).toBe('/account/pledges');
  });

  it('returns null on pages without the account navigation', () => {
    document.body.innerHTML = '<ul><li><a href="/account/pledges">Hangar</a></li></ul>';
    expect(findAccountNav(document)).toBeNull();
  });
});

describe('createNavItem', () => {
  it('mirrors the markup of the original items', () => {
    const item = createNavItem(document, '/account/pledges#hangar-manager', 'Hangar Manager');
    const link = item.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/account/pledges#hangar-manager');
    expect(link.querySelector('.line')).not.toBeNull();
    expect(link.querySelector('.bg')?.textContent).toBe('Hangar Manager');
  });
});

describe('setActiveItem', () => {
  it('moves the active state to the given item', () => {
    const nav = findAccountNav(document)!;
    const item = createNavItem(document, '#x', 'X');
    nav.prepend(item);

    setActiveItem(nav, item);
    expect([...nav.querySelectorAll('li.active')]).toEqual([item]);

    setActiveItem(nav, null);
    expect(nav.querySelectorAll('li.active')).toHaveLength(0);
  });
});

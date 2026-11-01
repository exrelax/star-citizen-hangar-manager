// Helpers for the left-hand navigation of the RSI account pages (`.sidenav ul > li > a`).

const HANGAR_LINK_SELECTOR = 'a[href$="/account/pledges"]';

/** The account navigation list, identified by its link to the original hangar. */
export function findAccountNav(doc: Document): HTMLUListElement | null {
  return doc.querySelector(HANGAR_LINK_SELECTOR)?.closest<HTMLUListElement>('.sidenav ul') ?? null;
}

export function findHangarLink(nav: HTMLUListElement): HTMLAnchorElement | null {
  return nav.querySelector<HTMLAnchorElement>(HANGAR_LINK_SELECTOR);
}

/** Builds a nav item with the same markup as the site's own items, so it inherits their styling. */
export function createNavItem(doc: Document, href: string, label: string): HTMLLIElement {
  const item = doc.createElement('li');
  const link = doc.createElement('a');
  link.href = href;
  link.className = 'trans-02s trans-color';

  const line = doc.createElement('span');
  line.className = 'line trans-02s trans-background';
  const text = doc.createElement('span');
  text.className = 'bg';
  text.textContent = label;

  link.append(line, text);
  item.append(link);
  return item;
}

/** Marks exactly one item of the navigation as active (or none for `null`). */
export function setActiveItem(nav: HTMLUListElement, item: HTMLLIElement | null): void {
  for (const li of nav.querySelectorAll(':scope > li')) {
    li.classList.toggle('active', li === item);
  }
}

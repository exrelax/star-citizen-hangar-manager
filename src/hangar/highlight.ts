import { parseBuybackPage } from '@/buyback/parse-buyback';
import { fetchBuybackPage } from '@/buyback/sync-buyback';
import { HIGHLIGHT_MAX_PAGE_HOPS } from '@/config';
import { parsePledgePage } from './parse-pledges';
import { buybackHref, myGearHref, pageFromUrl, urlWithoutHighlight } from './route';
import type { ListPage } from './smart-update/check';
import { fetchPledgePage } from './sync';

/** Class of the highlighted pledge in an original RSI list (styled in page.css). */
export const HIGHLIGHT_CLASS = 'shm-highlight';

type PagedList = ListPage<{ id: number }>;

/** An original RSI list a "show in …" link can point to. */
export interface HighlightList {
  /** The list entries (`<li>`) on the current page. */
  items(doc: Document): HTMLElement[];
  idOf(item: HTMLElement): number | undefined;
  parse(doc: Document): PagedList;
  fetchPage(page: number): Promise<PagedList>;
  /** Link to a page of the list that highlights the pledge (`pathname`: current page path). */
  href(pathname: string, page: number, pledgeId: number): string;
}

/** RSI's "My Gear" list (`/account/pledges`). */
export const MY_GEAR_LIST: HighlightList = {
  items: (doc) => [...doc.querySelectorAll<HTMLElement>('.list-items > li')],
  idOf: (item) =>
    Number(item.querySelector<HTMLInputElement>('input.js-pledge-id')?.value) || undefined,
  parse: parsePledgePage,
  fetchPage: (page) => fetchPledgePage(page),
  href: myGearHref,
};

/** RSI's buy back list (`/account/buy-back-pledges`). */
export const BUYBACK_LIST: HighlightList = {
  items: (doc) => [...doc.querySelectorAll<HTMLElement>('ul.pledges > li')],
  idOf: (item) => {
    const href = item.querySelector('a[href*="/pledge/buyback/"]')?.getAttribute('href') ?? '';
    const id =
      /\/pledge\/buyback\/(\d+)/.exec(href)?.[1] ??
      item.querySelector('[data-pledgeid]')?.getAttribute('data-pledgeid');
    return Number(id) || undefined;
  },
  parse: parseBuybackPage,
  fetchPage: (page) => fetchBuybackPage(page),
  // On the buy back page itself, the path is the buy back's – map it back to the hangar path.
  href: (pathname, page, pledgeId) =>
    buybackHref(pathname.replace(/buy-back-pledges\/?$/, 'pledges'), page, pledgeId),
};

/** The `<li>` of a pledge on the current page of an original list. */
export function findPledgeItem(
  doc: Document,
  pledgeId: number,
  list: HighlightList = MY_GEAR_LIST,
): HTMLElement | undefined {
  return list.items(doc).find((item) => list.idOf(item) === pledgeId);
}

/** Ids of the pledges on the current page of an original list, in list order. */
export function pageIds(doc: Document, list: HighlightList = MY_GEAR_LIST): number[] {
  return list
    .items(doc)
    .map((item) => list.idOf(item))
    .filter((id): id is number => id !== undefined);
}

/**
 * Where a pledge is relative to a page, using RSI's order by id (newest first):
 * -1 = on an earlier page, 1 = on a later page, 0 = within this page's range.
 */
export function directionOf(pledgeId: number, ids: readonly number[]): -1 | 0 | 1 {
  if (ids.length === 0) return 0;
  if (pledgeId > ids[0]!) return -1;
  if (pledgeId < ids.at(-1)!) return 1;
  return 0;
}

/**
 * Finds the page of a pledge that is not on the expected page any more (the stored hangar was
 * outdated), by loading the neighbouring pages in the given direction. Returns undefined if the
 * pledge isn't there (e.g. melted) or too far away.
 */
export async function locatePledgePage(
  pledgeId: number,
  fromPage: number,
  direction: -1 | 1,
  lastPage: number,
  fetchPage: (page: number) => Promise<PagedList>,
  maxHops = HIGHLIGHT_MAX_PAGE_HOPS,
): Promise<number | undefined> {
  for (let hop = 1; hop <= maxHops; hop++) {
    const page = fromPage + direction * hop;
    if (page < 1 || page > lastPage) return undefined;
    const ids = (await fetchPage(page)).pledges.map((pledge) => pledge.id);
    if (ids.includes(pledgeId)) return page;
    // Passed the place where it would have to be – it isn't in the hangar any more.
    if (directionOf(pledgeId, ids) !== direction) return undefined;
  }
  return undefined;
}

/** Scrolls to the pledge and marks it with a frame. */
export function highlightPledgeItem(item: HTMLElement) {
  item.classList.add(HIGHLIGHT_CLASS);
  item.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/**
 * Handles a "show in …" link on an original list: highlights the pledge, or – if the stored page
 * was outdated – opens the page it moved to. The parameter is removed from the URL afterwards,
 * so only the click highlights, not a reload.
 */
export async function revealPledge(
  pledgeId: number,
  list: HighlightList = MY_GEAR_LIST,
): Promise<void> {
  const clearParam = () =>
    history.replaceState(history.state, '', urlWithoutHighlight(location.href));

  const item = findPledgeItem(document, pledgeId, list);
  if (item) {
    clearParam();
    highlightPledgeItem(item);
    return;
  }

  const direction = directionOf(pledgeId, pageIds(document, list));
  if (direction !== 0) {
    const page = await locatePledgePage(
      pledgeId,
      pageFromUrl(location.search),
      direction,
      list.parse(document).lastPage,
      list.fetchPage,
    );
    if (page) {
      location.replace(list.href(location.pathname, page, pledgeId));
      return;
    }
  }
  clearParam();
  console.info(`[sc-hangar-manager] Pledge #${pledgeId} is not in this list (any more).`);
}

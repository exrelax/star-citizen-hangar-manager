import { parseBuybackPage } from '@/buyback/parse-buyback';
import { fetchBuybackPage } from '@/buyback/sync-buyback';
import { BUYBACK_PAGE_SIZE, HIGHLIGHT_MAX_PAGE_HOPS } from '@/config';
import { parsePledgePage } from './parse-pledges';
import {
  buybackHref,
  myGearHref,
  pageFromUrl,
  pageSizeFromUrl,
  urlWithoutHighlight,
} from './route';
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
  /**
   * URL of the page the pledge moved to, if it isn't on the current one (outdated stored page).
   * Defaults to searching the neighbouring pages (see `relocateByPages`).
   */
  relocate?(pledgeId: number): Promise<string | undefined>;
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
  href: (pathname, page, pledgeId) => buybackHref(hangarPath(pathname), page, pledgeId),
  relocate: (pledgeId) =>
    pageSizeFromUrl(location.search, BUYBACK_PAGE_SIZE) === BUYBACK_PAGE_SIZE
      ? relocateByPages(BUYBACK_LIST, pledgeId)
      : relocateSinglePledge(pledgeId),
};

function hangarPath(buybackPathname: string): string {
  return buybackPathname.replace(/buy-back-pledges\/?$/, 'pledges');
}

/**
 * A page that shows only one pledge (`pagesize=1`, see the "Show in Buy Back" setting) has the
 * wrong one when the stored position is outdated. Searching neighbours one pledge at a time would
 * take many requests, so the full list pages (250 pledges) around the position are searched and
 * the pledge's exact position is taken from there.
 */
async function relocateSinglePledge(pledgeId: number): Promise<string | undefined> {
  const position = (pageFromUrl(location.search) - 1) * pageSizeFromUrl(location.search, 1);
  const fullPage = Math.floor(position / BUYBACK_PAGE_SIZE) + 1;
  const fetchFull = (page: number) => fetchBuybackPage(page);

  const around = await fetchFull(fullPage);
  let page: number | undefined = fullPage;
  let ids = around.pledges.map((pledge) => pledge.id);
  if (!ids.includes(pledgeId)) {
    const direction = directionOf(pledgeId, ids);
    page =
      direction === 0
        ? undefined
        : await locatePledgePage(pledgeId, fullPage, direction, around.lastPage, fetchFull);
    if (!page) return undefined;
    ids = (await fetchFull(page)).pledges.map((pledge) => pledge.id);
  }
  const index = (page - 1) * BUYBACK_PAGE_SIZE + ids.indexOf(pledgeId);
  return buybackHref(hangarPath(location.pathname), index + 1, pledgeId, 1);
}

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

/** Searches the neighbouring pages of the current one in the direction the pledge must be. */
async function relocateByPages(list: HighlightList, pledgeId: number): Promise<string | undefined> {
  const direction = directionOf(pledgeId, pageIds(document, list));
  if (direction === 0) return undefined;
  const page = await locatePledgePage(
    pledgeId,
    pageFromUrl(location.search),
    direction,
    list.parse(document).lastPage,
    list.fetchPage,
  );
  return page ? list.href(location.pathname, page, pledgeId) : undefined;
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

  const url = await (list.relocate ?? ((id: number) => relocateByPages(list, id)))(pledgeId);
  if (url) {
    location.replace(url);
    return;
  }
  clearParam();
  console.info(`[star-citizen-hangar-manager] Pledge #${pledgeId} is not in this list (any more).`);
}

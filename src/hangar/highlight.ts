import { HIGHLIGHT_MAX_PAGE_HOPS } from '@/config';
import { parsePledgePage, type PledgePage } from './parse-pledges';
import { myGearHref, pageFromUrl, urlWithoutHighlight } from './route';
import { fetchPledgePage } from './sync';

/** Class of the highlighted pledge in the original "My Gear" list (styled in page.css). */
export const HIGHLIGHT_CLASS = 'shm-highlight';

/** The `<li>` of a pledge in the original "My Gear" list. */
export function findPledgeItem(doc: Document, pledgeId: number): HTMLElement | undefined {
  return [...doc.querySelectorAll<HTMLElement>('.list-items > li')].find(
    (li) => li.querySelector<HTMLInputElement>('input.js-pledge-id')?.value === String(pledgeId),
  );
}

/** Ids of the pledges on the current "My Gear" page, in list order. */
export function pageIds(doc: Document): number[] {
  return [...doc.querySelectorAll<HTMLInputElement>('.list-items > li input.js-pledge-id')].map(
    (input) => Number(input.value),
  );
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
  fetchPage: (page: number) => Promise<PledgePage>,
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
 * Handles a "Show in My Gear" link on the original list: highlights the pledge, or – if the stored
 * page was outdated – opens the page it moved to. The parameter is removed from the URL afterwards,
 * so only the click highlights, not a reload.
 */
export async function revealPledge(
  pledgeId: number,
  fetchPage: (page: number) => Promise<PledgePage> = (page) => fetchPledgePage(page),
): Promise<void> {
  const clearParam = () =>
    history.replaceState(history.state, '', urlWithoutHighlight(location.href));

  const item = findPledgeItem(document, pledgeId);
  if (item) {
    clearParam();
    highlightPledgeItem(item);
    return;
  }

  const direction = directionOf(pledgeId, pageIds(document));
  if (direction !== 0) {
    const page = await locatePledgePage(
      pledgeId,
      pageFromUrl(location.search),
      direction,
      parsePledgePage(document).lastPage,
      fetchPage,
    );
    if (page) {
      location.replace(myGearHref(location.pathname, page, pledgeId));
      return;
    }
  }
  clearParam();
  console.info(`[sc-hangar-manager] Pledge #${pledgeId} is not in "My Gear" (any more).`);
}

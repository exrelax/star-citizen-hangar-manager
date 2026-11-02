import { parseDate } from '@/hangar/parse-pledges';
import type { ListPage } from '@/hangar/smart-update/check';
import type { BuybackPledge } from './buyback';

/** Parses one page of `/en/account/buy-back-pledges`. Expects the English page variant. */
export function parseBuybackPage(doc: Document): ListPage<BuybackPledge> {
  const pledges = [...doc.querySelectorAll<HTMLElement>('ul.pledges > li')]
    .map(parseEntry)
    .filter((pledge): pledge is BuybackPledge => pledge !== undefined);
  return { pledges, lastPage: parseLastPage(doc) };
}

function parseEntry(li: HTMLElement): BuybackPledge | undefined {
  // Regular pledges link to `/pledge/buyback/<id>`; CCUs open a dialog with `data-pledgeid`.
  const href = li.querySelector('a[href*="/pledge/buyback/"]')?.getAttribute('href') ?? '';
  const id = Number(
    /\/pledge\/buyback\/(\d+)/.exec(href)?.[1] ??
      li.querySelector('[data-pledgeid]')?.getAttribute('data-pledgeid'),
  );
  if (!Number.isInteger(id) || id <= 0) return undefined;

  const title = text(li.querySelector('h1'));
  const image = li.querySelector('figure img')?.getAttribute('src');
  return {
    id,
    title,
    image: image ? new URL(image, 'https://robertsspaceindustries.com').href : undefined,
    reclaimedAt: parseDate(definition(li, 'Reclaim Date')),
    contained: definition(li, 'Contained'),
    isUpgrade: li.querySelector('.js-open-ship-upgrades') !== null || /^upgrade\b/i.test(title),
  };
}

/** Value of a `<dt>label</dt><dd>value</dd>` pair. */
function definition(li: HTMLElement, label: string): string {
  const term = [...li.querySelectorAll('dt')].find((dt) => text(dt) === label);
  return text(term?.nextElementSibling);
}

function parseLastPage(doc: Document): number {
  let lastPage = 1;
  for (const link of doc.querySelectorAll('.pager-wrapper a[href*="page="]')) {
    const page = Number(/[?&]page=(\d+)/.exec(link.getAttribute('href') ?? '')?.[1]);
    if (page > lastPage) lastPage = page;
  }
  return lastPage;
}

/** Items listed on the detail page of a buy back pledge (`/pledge/buyback/<id>`). */
export function parseBuybackDetail(doc: Document): string[] {
  return [...doc.querySelectorAll('.package-listing.item ul > li')]
    .map((li) => text(li))
    .filter(Boolean);
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

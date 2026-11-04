import { parseDate } from '@/hangar/parse-pledges';
import type { ListPage } from '@/hangar/smart-update/check';
import type { BuybackPledge, BuybackUpgrade } from './buyback';

/** A page of the buy back list, with the buy back tokens RSI shows above it. */
export interface BuybackListPage extends ListPage<BuybackPledge> {
  /** Buy back tokens left (see `parseBuybackTokens`); unset if RSI shows none. */
  tokens?: number;
}

/** Parses one page of `/en/account/buy-back-pledges`. Expects the English page variant. */
export function parseBuybackPage(doc: Document): BuybackListPage {
  const pledges = [...doc.querySelectorAll<HTMLElement>('ul.pledges > li')]
    .map(parseEntry)
    .filter((pledge): pledge is BuybackPledge => pledge !== undefined);
  const tokens = parseBuybackTokens(doc);
  return { pledges, lastPage: parseLastPage(doc), ...(tokens !== undefined && { tokens }) };
}

/**
 * The buy back tokens from RSI's yellow box above the list: how many pledges can still be bought
 * back with store credit ("You have <strong>2</strong> opportunity to buy back a pledge with store
 * credits."). Unset without the box or a number in it.
 */
export function parseBuybackTokens(doc: Document): number | undefined {
  const box = doc.querySelector('.buy-back-warning');
  if (!box) return undefined;
  const count = text(box.querySelector('strong')) || /you have (\d+|no)\b/i.exec(text(box))?.[1];
  if (count === undefined) return undefined;
  if (/^no$/i.test(count)) return 0;
  const tokens = Number(count);
  return Number.isInteger(tokens) && tokens >= 0 ? tokens : undefined;
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
  const ccuButton = li.querySelector('.js-open-ship-upgrades');
  const upgrade = ccuButton ? parseUpgrade(ccuButton) : undefined;
  return {
    id,
    title,
    image: image ? new URL(image, 'https://robertsspaceindustries.com').href : undefined,
    reclaimedAt: parseDate(definition(li, 'Reclaim Date')),
    contained: definition(li, 'Contained'),
    isUpgrade: ccuButton !== null || /^upgrade\b/i.test(title),
    ...(upgrade && { upgrade }),
  };
}

/** The ids on a CCU's "Buy Back" button (`data-fromshipid`, `data-toshipid`, `data-toskuid`). */
function parseUpgrade(button: Element): BuybackUpgrade | undefined {
  const id = (name: string) => Number(button.getAttribute(`data-${name}`));
  const upgrade = {
    fromShipId: id('fromshipid'),
    toShipId: id('toshipid'),
    toSkuId: id('toskuid'),
  };
  return Object.values(upgrade).every((value) => Number.isInteger(value) && value > 0)
    ? upgrade
    : undefined;
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

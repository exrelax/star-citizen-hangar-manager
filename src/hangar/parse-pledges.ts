import type { Pledge, PledgeItem } from './pledge';

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export interface PledgePage {
  pledges: Pledge[];
  /** Highest page number linked from the pager (1 if there is no pager). */
  lastPage: number;
}

/** Parses one page of `/en/account/pledges?page=N`. Expects the English page variant. */
export function parsePledgePage(doc: Document): PledgePage {
  const pledges = [...doc.querySelectorAll<HTMLElement>('.list-items > li')]
    .map(parsePledge)
    .filter((pledge): pledge is Pledge => pledge !== undefined);
  return { pledges, lastPage: parseLastPage(doc) };
}

function parsePledge(li: HTMLElement): Pledge | undefined {
  const id = Number(inputValue(li, 'js-pledge-id'));
  if (!Number.isInteger(id) || id <= 0) return undefined;

  const value = inputValue(li, 'js-pledge-value');
  return {
    id,
    name: inputValue(li, 'js-pledge-name'),
    title: text(li.querySelector('.pledge-title-row h3')),
    value,
    valueUsd: parseAmount(value),
    configurationValue: inputValue(li, 'js-pledge-configuration-value'),
    currency: inputValue(li, 'js-pledge-currency'),
    createdAt: parseDate(labelledText(li.querySelector('.date-col'))),
    availability: text(li.querySelector('.availability')),
    contains: labelledText(li.querySelector('.items-col')),
    image: backgroundImage(li.querySelector('.item-image-wrapper .image')),
    isLastAlpha: inputValue(li, 'js-pledge-last-alpha') === '1',
    isBuybackable: inputValue(li, 'js-pledge-not-buybackable') !== '1',
    isGiftable: li.querySelector('.js-gift-v2, .js-gift') !== null,
    isExchangeable: li.querySelector('.js-reclaim') !== null,
    isUpgradeable: li.querySelector('.js-apply-upgrade') !== null,
    nameReservations: jsonScript(li, 'js-pledge-name-reservations'),
    nameableShips: jsonScript(li, 'js-pledge-nameable-ships'),
    items: [...li.querySelectorAll<HTMLElement>('.items .item')].map(parseItem),
  };
}

function parseItem(item: HTMLElement): PledgeItem {
  const liner = item.querySelector('.liner');
  const manufacturerCode = text(liner?.querySelector('span')) || undefined;
  // "Anvil Aerospace (<span>ANVL</span>)" – the name is the text before the parenthesis.
  const manufacturer = text(liner).split('(')[0]?.trim() || undefined;
  return {
    title: text(item.querySelector('.title')),
    kind: text(item.querySelector('.kind')) || undefined,
    manufacturer,
    manufacturerCode,
    image: backgroundImage(item.querySelector('.image')),
  };
}

function parseLastPage(doc: Document): number {
  let lastPage = 1;
  for (const link of doc.querySelectorAll('.pager-wrapper a[href*="page="]')) {
    const page = Number(/[?&]page=(\d+)/.exec(link.getAttribute('href') ?? '')?.[1]);
    if (page > lastPage) lastPage = page;
  }
  return lastPage;
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Text of an element without its `<label>` (e.g. "Created:"). */
function labelledText(element: Element | null): string {
  if (!element) return '';
  const label = text(element.querySelector('label'));
  return text(element).slice(label.length).trim();
}

function inputValue(root: Element, className: string): string {
  return root.querySelector<HTMLInputElement>(`input.${className}`)?.value.trim() ?? '';
}

function jsonScript(root: Element, className: string): unknown {
  const source = root.querySelector(`script.${className}`)?.textContent;
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}

function backgroundImage(element: Element | null): string | undefined {
  const style = element?.getAttribute('style') ?? '';
  const url = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(style)?.[1];
  return url ? new URL(url, 'https://robertsspaceindustries.com').href : undefined;
}

/** "$1,234.50 USD" → 1234.5 */
export function parseAmount(value: string): number {
  const amount = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

/** "October 22, 2026" → "2026-10-22" (parsed by hand to stay independent of time zones). */
export function parseDate(value: string): string | undefined {
  const match = /^([a-z]+)\s+(\d{1,2}),\s*(\d{4})$/i.exec(value);
  if (!match) return undefined;
  const month = MONTHS.indexOf(match[1]!.toLowerCase()) + 1;
  if (month === 0) return undefined;
  return `${match[3]}-${String(month).padStart(2, '0')}-${match[2]!.padStart(2, '0')}`;
}

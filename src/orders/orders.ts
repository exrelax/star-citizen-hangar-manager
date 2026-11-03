import { parseAmount, parseDate } from '@/hangar/parse-pledges';
import { normalizeSearchText } from '@/hangar/search';

/*
 * Orders of the pledges. RSI's billing list (`/account/billing`) shows the orders without pledge
 * ids; the pledge log (`/api/account/pledgeLog`, the account's history) links them: every pledge
 * has one "Created … - order #…" entry. Buying a pledge back creates a new pledge (with a new id)
 * by a "Buy-Back order".
 */

/** An order of the billing list. */
export interface Order {
  /** e.g. "J4SHJM5S2GUF5". */
  id: string;
  /** What was paid with money, as RSI shows it ("$8.93 USD", "€124.53 EUR"); $0 for credits. */
  amount: string;
  /** ISO date (YYYY-MM-DD). */
  placedAt?: string;
  /**
   * Index in the billing list (newest first) as of the last sync: with a page size of 1, the
   * order is on page `position + 1`.
   */
  position?: number;
}

/** The order that created a pledge. */
export interface PledgeOrder {
  orderId: string;
  /** Created by buying a melted pledge back. */
  buyback: boolean;
}

/** Locally stored result of the last order sync. */
export interface OrdersSnapshot {
  /** Format version; snapshots of other versions are ignored and read again. */
  version: number;
  /** ISO timestamp of the last sync. */
  syncedAt: string;
  /** Orders by pledge id. */
  pledgeOrders: Record<number, PledgeOrder>;
  orders: Record<string, Order>;
  /** Newest entries of the pledge log, to read only what is new next time. */
  recentLogEntries: string[];
}

/** 2: orders know their position in the billing list. */
export const ORDERS_SNAPSHOT_VERSION = 2;

/** An order shown for a pledge: only orders paid with money (not with store credit). */
export interface PaidOrder extends Order {
  buyback: boolean;
}

/** Whether money was paid (store credit orders have an amount of 0). */
export function isPaidWithMoney(order: Order): boolean {
  return parseAmount(order.amount) > 0;
}

/** The money-paid order of a pledge, if there is one. */
export function paidOrderOf(
  pledgeId: number,
  snapshot: OrdersSnapshot | null | undefined,
): PaidOrder | undefined {
  if (snapshot?.version !== ORDERS_SNAPSHOT_VERSION) return undefined;
  const link = snapshot.pledgeOrders[pledgeId];
  const order = link && snapshot.orders[link.orderId];
  return order && isPaidWithMoney(order) ? { ...order, buyback: link.buyback } : undefined;
}

// "… #114419750 - Created by name - order #JJFLZ96A1KOBG, value: $7.15 USD"
// "… #114816820 - Created by name - Buy-Back order #4OLB2S5WUG6PX"
const CREATED = /#(\d+) - Created by .+? - (Buy-Back )?order #([A-Z0-9]+)/i;

/** The pledge and order of a "Created" entry of the pledge log; other entries give nothing. */
export function parseLogEntry(text: string): ({ pledgeId: number } & PledgeOrder) | undefined {
  const match = CREATED.exec(text);
  return match
    ? { pledgeId: Number(match[1]), orderId: match[3]!.toUpperCase(), buyback: !!match[2] }
    : undefined;
}

/** The entries of a page of the pledge log as RSI renders it (`<div class="pledge-log-entry">`). */
export function parseLogPage(html: string): string[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  return [...doc.querySelectorAll('.pledge-log-entry')].map((entry) => clean(entry.textContent));
}

/** One page of the billing list: its orders and the number of pages. */
export function parseBillingPage(doc: Document): { orders: Order[]; lastPage: number } {
  const orders = [...doc.querySelectorAll('ul.orders-item > li')]
    .map((li): Order | undefined => {
      const column = (label: string) => headerValue(li, label);
      const id = column('Order Id:').toUpperCase();
      if (!/^[A-Z0-9]+$/.test(id)) return undefined;
      // "October 30, 2026 19:55" – the date is enough.
      const placed = column('Order Placed:').replace(/\s+\d{1,2}:\d{2}$/, '');
      return { id, amount: column('Amount:'), placedAt: parseDate(placed) };
    })
    .filter((order): order is Order => order !== undefined);

  let lastPage = 1;
  for (const link of doc.querySelectorAll('a[href*="page="]')) {
    const page = Number(/[?&]page=(\d+)/.exec(link.getAttribute('href') ?? '')?.[1]);
    if (page > lastPage) lastPage = page;
  }
  return { orders, lastPage };
}

/** A labelled column of an order's header: "<span>Order Id:</span> J4SHJM5S2GUF5". */
function headerValue(li: Element, label: string): string {
  const span = [...li.querySelectorAll('.basic-infos .col > span')].find(
    (element) => clean(element.textContent) === label,
  );
  return clean(span?.parentElement?.textContent).replace(label, '').trim();
}

/** An order with everything RSI's billing list shows when it is expanded. */
export interface OrderDetails {
  id: string;
  /** Lower case id, as RSI uses it in URLs (the invoice). */
  slug: string;
  /** The header: "Order Placed", "Amount", "Order Id", "Status", "Payment", "Fulfillment". */
  header: LabelledValue[];
  /** The ordered items: column titles and rows. */
  items: Table;
  /** The billing address, line by line. */
  billTo: string[];
  /** "Items", "Credits used", "VAT", "Total", … */
  totals: LabelledValue[];
  /** The payments: column titles and rows. */
  payments: Table;
}

export interface LabelledValue {
  label: string;
  value: string;
}

export interface Table {
  columns: string[];
  rows: string[][];
}

/** The details of an order of the billing list (`ul.orders-item > li`). */
export function parseOrderDetails(li: Element): OrderDetails {
  const header = [...li.querySelectorAll('.basic-infos .col > span')].map((span) => {
    const label = clean(span.textContent);
    return { label: label.replace(/:$/, ''), value: headerValue(li, label) };
  });
  const slug = li.querySelector('[data-order-slug]')?.getAttribute('data-order-slug') ?? '';
  const paymentsHeading = [...li.querySelectorAll('h2')].find((heading) =>
    /payment info/i.test(heading.textContent ?? ''),
  );
  const paymentsTable = paymentsHeading?.nextElementSibling;
  return {
    id: headerValue(li, 'Order Id:').toUpperCase(),
    slug,
    header,
    items: parseTable(li.querySelector('table.billing-summary')),
    billTo: billToLines(li.querySelector('.bill-to')),
    totals: totalsOf(li.querySelector('.payment-wrapper .right-section')),
    payments: parseTable(paymentsTable?.tagName === 'TABLE' ? paymentsTable : null),
  };
}

function parseTable(table: Element | null): Table {
  const rows = [...(table?.querySelectorAll('tr') ?? [])].map((row) =>
    [...row.children].map((cell) => clean(cell.textContent)),
  );
  const [columns = [], ...body] = rows;
  // RSI adds an empty last column to the item table.
  const width = columns.at(-1) === '' ? columns.length - 1 : columns.length;
  return { columns: columns.slice(0, width), rows: body.map((row) => row.slice(0, width)) };
}

/** "<h4>Bill To:</h4><p><strong>Name</strong><br>Street<br>…" → its lines. */
function billToLines(element: Element | null): string[] {
  const paragraph = element?.querySelector('p');
  if (!paragraph) return [];
  const lines: string[] = [];
  let line = '';
  for (const node of paragraph.childNodes) {
    if (node.nodeName === 'BR') {
      lines.push(line);
      line = '';
    } else {
      line += node.textContent ?? '';
    }
  }
  lines.push(line);
  return lines.map(clean).filter(Boolean);
}

/** "<strong>Items:</strong>$7.50 USD<br><strong>VAT:</strong><span>$1.43 USD</span>" → pairs. */
function totalsOf(element: Element | null): LabelledValue[] {
  const totals: LabelledValue[] = [];
  for (const node of element?.querySelectorAll('.s-row') ?? []) {
    for (const child of node.childNodes) {
      if (child.nodeName === 'STRONG') {
        totals.push({ label: clean(child.textContent).replace(/:$/, ''), value: '' });
      } else if (child.nodeName !== 'BR' && totals.length) {
        totals.at(-1)!.value = clean(`${totals.at(-1)!.value} ${child.textContent ?? ''}`);
      }
    }
  }
  return totals;
}

const clean = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() ?? '';

/**
 * The view of a pledge with its money-paid order attached; the order id becomes searchable.
 * Returns the view itself when there is none.
 */
export function withOrder<T extends { id: number; searchText: string; order?: PaidOrder }>(
  view: T,
  snapshot: OrdersSnapshot | null | undefined,
): T {
  const order = paidOrderOf(view.id, snapshot);
  return order
    ? // Normalized texts start with a space before each word, so they just join.
      { ...view, order, searchText: view.searchText + normalizeSearchText(order.id) }
    : view;
}

/** The billing address shown in the demo instead of the real one. */
export const DEMO_BILL_TO = ['Alex Example', 'Sample Street 1', '12345 Example City', 'Utopia'];
/** Shown in the demo instead of the payment provider (e.g. "PAYPAL-GERMANY"). */
export const DEMO_PROCESSOR = 'PAYMENT PROVIDER';

/**
 * Order details for the demo: the order id replaced by a made-up one everywhere, the billing
 * address and the payment provider by dummy values.
 */
export function anonymizeOrderDetails(
  details: OrderDetails,
  fakeId: (id: string) => string,
): OrderDetails {
  const id = fakeId(details.id);
  const replaceId = (text: string) =>
    text
      .split(details.id)
      .join(id)
      .split(details.slug || details.id.toLowerCase())
      .join(id.toLowerCase());
  const cells = (table: Table, replace: (cell: string, column: string) => string): Table => ({
    columns: table.columns,
    rows: table.rows.map((row) =>
      row.map((cell, index) => replace(cell, table.columns[index] ?? '')),
    ),
  });
  return {
    id,
    slug: id.toLowerCase(),
    header: details.header.map(({ label, value }) => ({ label, value: replaceId(value) })),
    items: cells(details.items, replaceId),
    billTo: details.billTo.length ? DEMO_BILL_TO : [],
    totals: details.totals.map(({ label, value }) => ({ label, value: replaceId(value) })),
    payments: cells(details.payments, (cell, column) =>
      /processor/i.test(column) ? DEMO_PROCESSOR : replaceId(cell),
    ),
  };
}

/** "Jane Doe, Main St. 12" → "xxxx xxx, xxxx xx. 00": same shape, nothing of the original. */
const unreadable = (text: string) => text.replace(/\p{L}/gu, 'x').replace(/\d/g, '0');

/** Shown instead of hidden order ids and amounts. */
export const HIDDEN = '•••';

// "$8.93 USD", "€124.53 EUR", "£5.00"
const MONEY = /[$€£]\s?[\d.,]+(?:\s?[A-Z]{3})?/g;

/**
 * Order details following the settings for hiding sensitive information: with `hideIds` the
 * order id is replaced by `HIDDEN` and the billing address (with the name) made unreadable – every
 * letter an "x", every digit a "0", so it keeps its shape for a blurred look but never reaches the
 * page; with `hideValues` all amounts are replaced by `HIDDEN` (the tables keep their layout).
 */
export function maskOrderDetails(
  details: OrderDetails,
  { hideIds, hideValues }: { hideIds: boolean; hideValues: boolean },
): OrderDetails {
  if (!hideIds && !hideValues) return details;
  const mask = (text: string) => {
    let masked = text;
    if (hideIds) {
      masked = masked.split(details.id).join(HIDDEN);
      if (details.slug) masked = masked.split(details.slug).join(HIDDEN);
    }
    return hideValues ? masked.replace(MONEY, HIDDEN) : masked;
  };
  const table = (input: Table): Table => ({
    columns: input.columns,
    rows: input.rows.map((row) => row.map(mask)),
  });
  const pairs = (input: LabelledValue[]) =>
    input.map(({ label, value }) => ({ label, value: mask(value) }));
  return {
    ...details,
    billTo: hideIds ? details.billTo.map(unreadable) : details.billTo,
    header: pairs(details.header),
    items: table(details.items),
    totals: pairs(details.totals),
    payments: table(details.payments),
  };
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-09-30" → "September 30, 2026", as RSI's billing list writes dates. */
function longDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTH_NAMES[month! - 1]} ${day}, ${year}`;
}

/**
 * Order details with the purchase date moved from `from` to `to` (ISO dates), in RSI's two
 * spellings ("September 30, 2026" and "2026-09-30") – for the demo's recent purchases.
 */
export function redateOrderDetails(details: OrderDetails, from: string, to: string): OrderDetails {
  if (from === to) return details;
  const redate = (text: string) =>
    text.split(longDate(from)).join(longDate(to)).split(from).join(to);
  const table = (input: Table): Table => ({
    columns: input.columns,
    rows: input.rows.map((row) => row.map(redate)),
  });
  const pairs = (input: LabelledValue[]) =>
    input.map(({ label, value }) => ({ label, value: redate(value) }));
  return {
    ...details,
    header: pairs(details.header),
    items: table(details.items),
    totals: pairs(details.totals),
    payments: table(details.payments),
  };
}

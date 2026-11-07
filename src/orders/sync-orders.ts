import { ORDERS } from '@/config';
import { listPageWork, type ProgressSink } from '@/hangar/sync-progress';
import { mapWithConcurrency } from '@/shared/lib/pool';
import { isThrottled, withRetry } from '@/shared/lib/retry';
import { postRsiJson } from '@/shared/rsi-api';
import {
  ORDERS_SNAPSHOT_VERSION,
  parseBillingPage,
  parseLogEntry,
  parseLogPage,
  parseOrderDetails,
  type Order,
  type OrderDetails,
  type OrdersSnapshot,
} from './orders';
import { ordersMeta, ordersSnapshot } from './orders-storage';
import { recordCheck, recordSync } from '@/storage/meta';

export interface LogPage {
  entries: string[];
  pageCount: number;
}
export interface BillingPage {
  orders: Order[];
  lastPage: number;
}

export interface OrderSyncDeps {
  fetchLogPage?: (page: number) => Promise<LogPage>;
  fetchBillingPage?: (page: number) => Promise<BillingPage>;
  /** Hears about the pages; for later syncs only known once they reach known entries. */
  progress?: ProgressSink;
  concurrency?: number;
  /** Reads the whole history again, even with stored orders (from the settings). */
  full?: boolean;
}

const LOG_PAGE_WORK = listPageWork(25);
const BILLING_PAGE_WORK = listPageWork(ORDERS.billingPageSize);

export interface OrderSyncResult {
  snapshot: OrdersSnapshot;
  /** Pledge log entries new since the last read; none on the first read. */
  newLogEntries: string[];
}

/**
 * First step of the order sync: reads the first page of the pledge log and of the billing list.
 * Without a stored snapshot everything is read; otherwise only the pages up to the first known
 * entry (the log and the billing list are sorted newest first). Nothing is stored unless every
 * page was read.
 */
export async function prepareOrderSync(
  deps: OrderSyncDeps = {},
): Promise<() => Promise<OrderSyncResult>> {
  const { progress, concurrency = ORDERS.concurrency, full = false } = deps;
  // Counted for the status line: what a check read.
  let pagesRead = 0;
  const count =
    <T>(fetch: (page: number) => Promise<T>) =>
    (page: number) => {
      pagesRead++;
      return fetch(page);
    };
  const fetchLogPage = count(deps.fetchLogPage ?? fetchPledgeLogPage);
  const fetchBillingPage = count(deps.fetchBillingPage ?? fetchBillingListPage);

  const stored = await ordersSnapshot.getValue();
  const previous = !full && stored?.version === ORDERS_SNAPSHOT_VERSION ? stored : null;
  const knownEntries = new Set(previous?.recentLogEntries);
  const [firstLog, firstBilling] = await Promise.all([fetchLogPage(1), fetchBillingPage(1)]);

  // Without a snapshot all pages are known to be needed; otherwise each further one is
  // announced when it turns out to be needed.
  const logPages = previous ? 1 : firstLog.pageCount;
  const billingPages = previous ? 1 : firstBilling.lastPage;
  progress?.expect(
    logPages + billingPages,
    logPages * LOG_PAGE_WORK + billingPages * BILLING_PAGE_WORK,
  );
  progress?.complete(2, LOG_PAGE_WORK + BILLING_PAGE_WORK);

  return async () => {
    const logEntries = await readPages({
      first: firstLog.entries,
      lastPage: firstLog.pageCount,
      fetchPage: async (page) => (await fetchLogPage(page)).entries,
      isKnown: previous ? (entries) => entries.some((entry) => knownEntries.has(entry)) : undefined,
      work: LOG_PAGE_WORK,
      progress,
      concurrency,
    });
    const orders = await readPages({
      first: firstBilling.orders,
      lastPage: firstBilling.lastPage,
      fetchPage: async (page) => (await fetchBillingPage(page)).orders,
      isKnown: previous ? (page) => page.some((order) => previous.orders[order.id]) : undefined,
      work: BILLING_PAGE_WORK,
      progress,
      concurrency,
    });

    // The newest log entry tells whether anything happened on the account since the last read.
    const fingerprint = firstLog.entries[0] ?? '';
    // New log entries: what happened on the account since the last read (all of it without one).
    const newLogEntries = previous ? logEntries.filter((entry) => !knownEntries.has(entry)) : [];
    const newEntries = newLogEntries.length;
    const newOrders = orders.filter((order) => !previous?.orders[order.id]).length;
    if (previous && newEntries === 0 && newOrders === 0) {
      await recordCheck(ordersMeta, { status: 'unchanged', pages: pagesRead }, { fingerprint });
      return { snapshot: previous, newLogEntries };
    }

    const snapshot: OrdersSnapshot = {
      version: ORDERS_SNAPSHOT_VERSION,
      syncedAt: new Date().toISOString(),
      pledgeOrders: { ...previous?.pledgeOrders },
      // Copies: the positions are updated below.
      orders: Object.fromEntries(
        Object.entries(previous?.orders ?? {}).map(([id, order]) => [id, { ...order }]),
      ),
      recentLogEntries: firstLog.entries,
    };
    for (const entry of logEntries) {
      const link = parseLogEntry(entry);
      if (link)
        snapshot.pledgeOrders[link.pledgeId] = { orderId: link.orderId, buyback: link.buyback };
    }
    // The pages read are the newest, from page 1 on: their orders' index is their position.
    // Orders not read again moved down by the number of new ones.
    for (const order of Object.values(snapshot.orders)) {
      if (order.position !== undefined) order.position += newOrders;
    }
    orders.forEach((order, position) => (snapshot.orders[order.id] = { ...order, position }));
    await ordersSnapshot.setValue(snapshot);
    if (previous) {
      await recordCheck(
        ordersMeta,
        { status: 'updated', added: newEntries, pages: pagesRead },
        { fingerprint },
      );
    } else {
      await recordSync(ordersMeta, { fingerprint });
    }
    return { snapshot, newLogEntries };
  };
}

/**
 * Reads the new orders for smart updates: usually just the first pages. Without stored orders it
 * does nothing – reading everything (hundreds of pages) is left to the full refresh.
 */
export async function updateOrders(deps: OrderSyncDeps = {}): Promise<OrderSyncResult | null> {
  const stored = await ordersSnapshot.getValue();
  if (stored?.version !== ORDERS_SNAPSHOT_VERSION) return null;
  const run = await prepareOrderSync(deps);
  return run();
}

interface ReadPagesOptions<T> {
  first: T[];
  lastPage: number;
  fetchPage: (page: number) => Promise<T[]>;
  /** Set for later syncs: pages are read one by one until one has known entries. */
  isKnown?: (page: T[]) => boolean;
  work: number;
  progress?: ProgressSink;
  concurrency: number;
}

/** The entries of all pages needed, newest first. */
async function readPages<T>(options: ReadPagesOptions<T>): Promise<T[]> {
  const { first, lastPage, fetchPage, isKnown, work, progress, concurrency } = options;
  if (!isKnown) {
    const pages = Array.from({ length: lastPage - 1 }, (_, index) => index + 2);
    const rest = await mapWithConcurrency(pages, concurrency, async (page) => {
      const entries = await fetchPage(page);
      progress?.complete(1, work);
      return entries;
    });
    return [first, ...rest].flat();
  }

  const entries = [...first];
  let current = first;
  for (let page = 2; page <= lastPage && !isKnown(current); page++) {
    progress?.expect(1, work);
    current = await fetchPage(page);
    progress?.complete(1, work);
    entries.push(...current);
  }
  return entries;
}

/** A page of the pledge log; throttled requests are tried again (see `ORDERS`). */
export async function fetchPledgeLogPage(page: number): Promise<LogPage> {
  const response = await withRetry(
    () =>
      postRsiJson<{
        success: number;
        msg?: string;
        data?: { rendered?: string; pagecount?: number };
      }>('/api/account/pledgeLog', { page }),
    ORDERS.retryDelaysMs,
    isThrottled,
  );
  if (response.success !== 1) throw new Error(response.msg ?? 'Loading the pledge log failed');
  return {
    entries: parseLogPage(response.data?.rendered ?? ''),
    pageCount: response.data?.pagecount ?? 1,
  };
}

/**
 * The details of an order, from RSI's billing list with a page size of 1 at the stored position.
 * If new orders moved it, the 100-order pages around that position are searched.
 */
export async function fetchOrderDetails(order: Order): Promise<OrderDetails> {
  const position = order.position ?? 0;
  const find = async (page: number, pageSize: number) => {
    const doc = await fetchBillingDocument(page, pageSize);
    const li = [...doc.querySelectorAll('ul.orders-item > li')].find(
      (element) => parseOrderDetails(element).id === order.id,
    );
    return li && parseOrderDetails(li);
  };
  const exact = await find(position + 1, 1);
  if (exact) return exact;
  const page = Math.floor(position / ORDERS.billingPageSize) + 1;
  for (const candidate of [page, page + 1, page - 1].filter((number) => number >= 1)) {
    const details = await find(candidate, ORDERS.billingPageSize);
    if (details) return details;
  }
  throw new Error(`Order ${order.id} not found in the billing list`);
}

/** A page of the billing list with the user's session (English variant). */
export async function fetchBillingListPage(page: number): Promise<BillingPage> {
  return parseBillingPage(await fetchBillingDocument(page, ORDERS.billingPageSize));
}

async function fetchBillingDocument(page: number, pageSize: number): Promise<Document> {
  const url = `/en/account/billing?storefront=&page=${page}&pagesize=${pageSize}`;
  const response = await withRetry(
    async () => {
      const result = await fetch(url, { credentials: 'include' });
      if (!result.ok) throw new Error(`Loading billing page ${page} failed: HTTP ${result.status}`);
      return result;
    },
    ORDERS.retryDelaysMs,
    isThrottled,
  );
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  // The billing section has its own navigation (billing, addresses); logged out sessions get
  // the login page instead.
  if (!doc.querySelector('.sidenav a[href$="/account/billing"]')) {
    throw new Error(`Billing page ${page} is no account page – are you still logged in?`);
  }
  return doc;
}

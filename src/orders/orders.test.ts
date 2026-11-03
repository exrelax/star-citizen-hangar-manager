// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  anonymizeOrderDetails,
  DEMO_BILL_TO,
  DEMO_PROCESSOR,
  HIDDEN,
  maskOrderDetails,
  redateOrderDetails,
  ORDERS_SNAPSHOT_VERSION,
  paidOrderOf,
  parseBillingPage,
  parseLogEntry,
  parseLogPage,
  parseOrderDetails,
  withOrder,
  type OrdersSnapshot,
} from './orders';
import { ordersSnapshot } from './orders-storage';
import { prepareOrderSync, updateOrders, type BillingPage, type LogPage } from './sync-orders';

describe('parseLogEntry', () => {
  it('links a created pledge to its order, also for buy backs', () => {
    expect(
      parseLogEntry(
        'Jan 18 2020, 1:22 am - Package - Cutlass Black #21040666 - Created by name - order #J4SHJM5S2GUF5, value: $115.00 USD',
      ),
    ).toEqual({ pledgeId: 21040666, orderId: 'J4SHJM5S2GUF5', buyback: false });
    expect(
      parseLogEntry(
        'Oct 30 2026, 7:55 pm - Paints - Paladin - Shadowfall Paint #114816820 - Created by name - Buy-Back order #4OLB2S5WUG6PX',
      ),
    ).toEqual({ pledgeId: 114816820, orderId: '4OLB2S5WUG6PX', buyback: true });
  });

  it('ignores entries without a created order', () => {
    // The melted pledge bought back keeps its id only in this entry.
    expect(
      parseLogEntry(
        'Paints - Paladin - Shadowfall Paint #80478064 - Buy-back by name - order #4OLB2S5WUG6PX',
      ),
    ).toBeUndefined();
    expect(
      parseLogEntry('Oct 10 2020, 2:25 am - 300 Million Reward #25517346 - pistol'),
    ).toBeUndefined();
    expect(parseLogEntry('Package - Aurora #1 - Claimed as a gift by name')).toBeUndefined();
  });

  it('reads the entries of a log page', () => {
    expect(
      parseLogPage(
        '<div class="pledge-log-entry"> <p>Oct 22 2026 - <span class="important">Paint</span> #1 - Created by a - order #A</p> </div>',
      ),
    ).toEqual(['Oct 22 2026 - Paint #1 - Created by a - order #A']);
  });
});

describe('parseBillingPage', () => {
  const order = (id: string, amount: string) => `
    <li><div class="row pledge"><div class="basic-infos clearfix">
      <div class="col date"><span>Order Placed:</span> October 30, 2026 19:55</div>
      <div class="col amount"><span>Amount:</span> ${amount}</div>
      <div class="col"><span>Order Id:</span> ${id}</div>
    </div></div></li>`;

  it('reads id, amount and date of each order and the last page', () => {
    const doc = new DOMParser().parseFromString(
      `<ul class="orders-item">${order('4OLB2S5WUG6PX', '$8.93 USD')}${order('JJFLZ96A1KOBG', '$0.00 USD')}</ul>
       <a href="/en/account/billing?storefront=&page=16&pagesize=100">16</a>`,
      'text/html',
    );
    expect(parseBillingPage(doc)).toEqual({
      orders: [
        { id: '4OLB2S5WUG6PX', amount: '$8.93 USD', placedAt: '2026-10-30' },
        { id: 'JJFLZ96A1KOBG', amount: '$0.00 USD', placedAt: '2026-10-30' },
      ],
      lastPage: 16,
    });
  });
});

describe('parseOrderDetails', () => {
  it('reads header, items, billing address, totals and payments of an expanded order', () => {
    const doc = new DOMParser().parseFromString(
      `<ul class="orders-item"><li><div class="row pledge">
        <div class="basic-infos clearfix">
          <div class="col date"><span>Order Placed:</span> October 30, 2026 19:55</div>
          <div class="col amount"><span>Amount:</span> $8.93 USD</div>
          <div class="col"><span>Order Id:</span> 4OLB2S5WUG6PX</div>
        </div>
        <div class="more js-more">
          <h2>ORDER SUMMARY <a class="js-print-invoice" data-order-slug="4olb2s5wug6px">Retrieve invoice</a></h2>
          <table class="billing-summary"><tbody>
            <tr><th>Item</th><th>Price</th><th>Qty.</th><th>Discount</th><th>Total</th><th></th></tr>
            <tr><td>Paints - Paladin - Shadowfall Paint</td><td>$7.50 USD</td><td>1</td><td><span>$0.00 USD</span></td><td>$7.50 USD</td></tr>
          </tbody></table>
          <div class="payment-wrapper clearfix">
            <div class="left-section"><div class="bill-to address"><h4>Bill To:</h4>
              <p><strong>Jane Doe</strong><br>Main Street 1<br>Cologne, Germany<br></p></div></div>
            <div class="right-section">
              <div class="s-row"><strong>Items:</strong>$7.50 USD<br><strong>Credits used:</strong><span>$0.00 USD</span></div>
              <div class="s-row last"><strong>Total:</strong>$8.93 USD</div>
            </div>
          </div>
          <div><h2>PAYMENT INFO</h2><table>
            <tr><th>Date</th><th>Processor</th><th>Status</th><th>Amount</th></tr>
            <tr><td>2026-10-30, 19:55</td><td>PAYPAL-UK-USD</td><td>PAID</td><td>$8.93 USD</td></tr>
          </table></div>
        </div>
      </div></li></ul>`,
      'text/html',
    );
    expect(parseOrderDetails(doc.querySelector('ul.orders-item > li')!)).toEqual({
      id: '4OLB2S5WUG6PX',
      slug: '4olb2s5wug6px',
      header: [
        { label: 'Order Placed', value: 'October 30, 2026 19:55' },
        { label: 'Amount', value: '$8.93 USD' },
        { label: 'Order Id', value: '4OLB2S5WUG6PX' },
      ],
      items: {
        columns: ['Item', 'Price', 'Qty.', 'Discount', 'Total'],
        rows: [['Paints - Paladin - Shadowfall Paint', '$7.50 USD', '1', '$0.00 USD', '$7.50 USD']],
      },
      billTo: ['Jane Doe', 'Main Street 1', 'Cologne, Germany'],
      totals: [
        { label: 'Items', value: '$7.50 USD' },
        { label: 'Credits used', value: '$0.00 USD' },
        { label: 'Total', value: '$8.93 USD' },
      ],
      payments: {
        columns: ['Date', 'Processor', 'Status', 'Amount'],
        rows: [['2026-10-30, 19:55', 'PAYPAL-UK-USD', 'PAID', '$8.93 USD']],
      },
    });
  });
});

describe('anonymizeOrderDetails', () => {
  it('leaves no real order id, address or payment provider in the details', () => {
    const real = {
      id: '4OLB2S5WUG6PX',
      slug: '4olb2s5wug6px',
      header: [
        { label: 'Order Id', value: '4OLB2S5WUG6PX' },
        { label: 'Amount', value: '$8.93 USD' },
      ],
      items: { columns: ['Item', 'Total'], rows: [['Paint (order 4OLB2S5WUG6PX)', '$7.50 USD']] },
      billTo: ['Jane Doe', 'Main Street 1', 'Cologne'],
      totals: [{ label: 'Total', value: '$8.93 USD' }],
      payments: {
        columns: ['Date', 'Processor', 'Status', 'Amount'],
        rows: [['2026-10-30, 19:55', 'PAYPAL-UK-USD', 'PAID', '$8.93 USD']],
      },
    };
    const demo = anonymizeOrderDetails(real, () => 'FAKE12345');
    const text = JSON.stringify(demo);

    expect(text).not.toMatch(/4OLB2S5WUG6PX|4olb2s5wug6px|Jane Doe|Main Street|Cologne|PAYPAL/);
    expect(demo).toMatchObject({ id: 'FAKE12345', slug: 'fake12345', billTo: DEMO_BILL_TO });
    expect(demo.header[0]!.value).toBe('FAKE12345');
    expect(demo.payments.rows[0]).toEqual([
      '2026-10-30, 19:55',
      DEMO_PROCESSOR,
      'PAID',
      '$8.93 USD',
    ]);
  });
});

describe('maskOrderDetails', () => {
  const details = {
    id: '4OLB2S5WUG6PX',
    slug: '4olb2s5wug6px',
    header: [
      { label: 'Order Id', value: '4OLB2S5WUG6PX' },
      { label: 'Amount', value: '€124.53 EUR' },
    ],
    items: { columns: ['Item', 'Total'], rows: [['Polaris', '$7.50 USD']] },
    billTo: ['Jane Doe'],
    totals: [{ label: 'VAT', value: '$1.43 USD' }],
    payments: { columns: ['Processor', 'Amount'], rows: [['PAYPAL', '$8.93 USD']] },
  };

  it('hides the order id and the amounts, each by its setting', () => {
    const ids = maskOrderDetails(details, { hideIds: true, hideValues: false });
    expect(ids.header.map((field) => field.value)).toEqual([HIDDEN, '€124.53 EUR']);
    // Name and address become unreadable along with the ids.
    expect(ids.billTo).toEqual(['xxxx xxx']);

    const values = maskOrderDetails(details, { hideIds: false, hideValues: true });
    expect(values.header.map((field) => field.value)).toEqual(['4OLB2S5WUG6PX', HIDDEN]);
    expect(values.items.rows).toEqual([['Polaris', HIDDEN]]);
    expect(values.totals[0]!.value).toBe(HIDDEN);
    expect(values.payments.rows).toEqual([['PAYPAL', HIDDEN]]);

    expect(maskOrderDetails(details, { hideIds: false, hideValues: false })).toBe(details);
  });
});

describe('redateOrderDetails', () => {
  it('moves the purchase date in both of RSI spellings', () => {
    const details = {
      id: 'A',
      slug: 'a',
      header: [{ label: 'Order Placed', value: 'September 30, 2026 17:32' }],
      items: { columns: [], rows: [] },
      billTo: [],
      totals: [],
      payments: { columns: ['Date', 'Amount'], rows: [['2026-09-30, 17:33', '$1.00 USD']] },
    };
    const moved = redateOrderDetails(details, '2026-09-30', '2026-10-24');
    expect(moved.header[0]!.value).toBe('October 24, 2026 17:32');
    expect(moved.payments.rows[0]![0]).toBe('2026-10-24, 17:33');
  });
});

describe('paidOrderOf / withOrder', () => {
  const snapshot: OrdersSnapshot = {
    version: ORDERS_SNAPSHOT_VERSION,
    syncedAt: '2026-11-01T00:00:00.000Z',
    pledgeOrders: {
      1: { orderId: 'MONEY', buyback: false },
      2: { orderId: 'CREDIT', buyback: false },
    },
    orders: {
      MONEY: { id: 'MONEY', amount: '€124.53 EUR', placedAt: '2020-01-18' },
      CREDIT: { id: 'CREDIT', amount: '$0.00 USD' },
    },
    recentLogEntries: [],
  };

  it('gives only orders paid with money, and makes them searchable', () => {
    expect(paidOrderOf(1, snapshot)?.id).toBe('MONEY');
    expect(paidOrderOf(2, snapshot)).toBeUndefined();
    expect(paidOrderOf(3, snapshot)).toBeUndefined();
    expect(withOrder({ id: 1, searchText: ' aurora' }, snapshot).searchText).toBe(' aurora money');
    expect(withOrder({ id: 2, searchText: 'aurora' }, snapshot)).toEqual({
      id: 2,
      searchText: 'aurora',
    });
  });
});

describe('order sync', () => {
  beforeEach(() => fakeBrowser.reset());

  const entry = (pledge: number, order: string) =>
    `Item #${pledge} - Created by name - order #${order}, value: $1.00 USD`;

  /** A log of `count` entries, newest first, 2 per page; billing with one order per page. */
  function fakeRsi(count: number) {
    const log = Array.from({ length: count }, (_, index) =>
      entry(count - index, `O${count - index}`),
    );
    const fetchLogPage = vi.fn(async (page: number): Promise<LogPage> => ({
      entries: log.slice((page - 1) * 2, page * 2),
      pageCount: Math.ceil(log.length / 2),
    }));
    const fetchBillingPage = vi.fn(async (page: number): Promise<BillingPage> => ({
      orders: [{ id: `O${count - page + 1}`, amount: '$1.00 USD' }],
      lastPage: count,
    }));
    return { fetchLogPage, fetchBillingPage };
  }

  it('reads everything the first time', async () => {
    const rsi = fakeRsi(6);
    const snapshot = await (await prepareOrderSync(rsi))();
    expect(rsi.fetchLogPage).toHaveBeenCalledTimes(3);
    expect(rsi.fetchBillingPage).toHaveBeenCalledTimes(6);
    expect(Object.keys(snapshot.pledgeOrders)).toHaveLength(6);
    expect(await ordersSnapshot.getValue()).toEqual(snapshot);
  });

  it('later reads only up to the first known entries', async () => {
    await (
      await prepareOrderSync(fakeRsi(6))
    )();
    // Three new pledges with three new orders since.
    const rsi = fakeRsi(9);
    const snapshot = await updateOrders(rsi);
    // Page 2 holds the newest entries known from last time (#6, #5).
    expect(rsi.fetchLogPage.mock.calls.map(([page]) => page)).toEqual([1, 2]);
    expect(rsi.fetchBillingPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3, 4]);
    expect(Object.keys(snapshot!.pledgeOrders)).toHaveLength(9);
    expect(Object.keys(snapshot!.orders)).toHaveLength(9);
    // Positions in the billing list (newest first): the old orders moved down by three.
    expect(snapshot!.orders['O9']!.position).toBe(0);
    expect(snapshot!.orders['O6']!.position).toBe(3);
    expect(snapshot!.orders['O1']!.position).toBe(8);
  });

  it('leaves the first full read to the full refresh', async () => {
    const rsi = fakeRsi(6);
    expect(await updateOrders(rsi)).toBeNull();
    expect(rsi.fetchLogPage).not.toHaveBeenCalled();
  });
});

// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { parseAmount, parseDate, parsePledgePage } from './parse-pledges';

// Trimmed-down copy of the markup of `/en/account/pledges` with made-up values.
const pledgeHtml = (id: number, extra = '') => `
  <li>
    <div class="row">
      <div class="basic-infos clearfix">
        <div class="item-image-wrapper">
          <div class="image" style="background-image:url('/media/pledge-${id}.jpg');"></div>
        </div>
        <div class="wrapper-col">
          <div class="title-col">
            <div class="pledge-title-row"><h3>Package - Test Ship ${id}</h3></div>
            <script class="js-pledge-name-reservations" type="application/json">[]</script>
            <script class="js-pledge-nameable-ships" type="application/json">null</script>
            <input type="hidden" class="js-pledge-id" value="${id}" />
            <input type="hidden" class="js-pledge-name" value="Package - Test Ship ${id}" />
            <input type="hidden" class="js-pledge-value" value="$1,045.50 USD" />
            <input type="hidden" class="js-pledge-configuration-value" value="$0.00 USD" />
            <input type="hidden" class="js-pledge-currency" value="Store Credit" />
            <input type="hidden" class="js-pledge-last-alpha" value="0" />
            <input type="hidden" class="js-pledge-not-buybackable" value="0" />
            <span class="availability">Attributed</span>
          </div>
          <div class="date-col"><label>Created:</label> October 2, 2026</div>
          <div class="items-col"><label>Contains:</label> Test Ship and 1 item</div>
        </div>
      </div>
      <div class="items more js-more">
        <h2>Items</h2>
        ${extra}
        <div class="content-block1">
          <div class="with-images">
            <div class="item">
              <div class="image" style="background-image:url('https://media.example.com/ship.jpg');"></div>
              <div class="text">
                <div class="title">Test Ship</div>
                <div class="kind">Ship</div>
                <div class="liner">Anvil Aerospace (<span>ANVL</span>)</div>
              </div>
            </div>
            <div class="item">
              <div class="text"><div class="title">Test Paint</div><div class="kind">Skin</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </li>`;

const pageHtml = (items: string, pages: number[]) => `
  <div class="inner-content">
    <div class="billing-title-pager-wrapper">
      <div class="options-selector pager-wrapper">
        ${pages.map((page) => `<a href="/account/pledges?page=${page}">${page}</a>`).join('')}
      </div>
    </div>
    <ul class="list-items">${items}</ul>
  </div>`;

const parse = (html: string) => parsePledgePage(new DOMParser().parseFromString(html, 'text/html'));

describe('parsePledgePage', () => {
  it('reads all pledge fields and contained items', () => {
    const { pledges } = parse(
      pageHtml(
        pledgeHtml(
          42,
          '<a class="shadow-button js-gift-v2">Gift</a><a class="js-reclaim">Exchange</a>',
        ),
        [1],
      ),
    );

    expect(pledges).toEqual([
      {
        id: 42,
        name: 'Package - Test Ship 42',
        title: 'Package - Test Ship 42',
        value: '$1,045.50 USD',
        valueUsd: 1045.5,
        configurationValue: '$0.00 USD',
        currency: 'Store Credit',
        createdAt: '2026-10-02',
        availability: 'Attributed',
        contains: 'Test Ship and 1 item',
        image: 'https://robertsspaceindustries.com/media/pledge-42.jpg',
        isLastAlpha: false,
        isBuybackable: true,
        isGiftable: true,
        isExchangeable: true,
        isUpgradeable: false,
        nameReservations: [],
        nameableShips: null,
        items: [
          {
            title: 'Test Ship',
            kind: 'Ship',
            manufacturer: 'Anvil Aerospace',
            manufacturerCode: 'ANVL',
            image: 'https://media.example.com/ship.jpg',
          },
          {
            title: 'Test Paint',
            kind: 'Skin',
            manufacturer: undefined,
            manufacturerCode: undefined,
            image: undefined,
          },
        ],
      },
    ]);
  });

  it('takes the highest linked page as last page', () => {
    expect(parse(pageHtml(pledgeHtml(1), [1, 2, 3, 99])).lastPage).toBe(99);
  });

  it('treats a page without pager as the only page', () => {
    expect(parse(pageHtml(pledgeHtml(1), [])).lastPage).toBe(1);
  });

  it('skips entries without a valid pledge id', () => {
    const { pledges } = parse(pageHtml('<li><h3>broken</h3></li>' + pledgeHtml(7), [1]));
    expect(pledges.map((pledge) => pledge.id)).toEqual([7]);
  });
});

describe('parseAmount', () => {
  it.each([
    ['$45.00 USD', 45],
    ['$1,234.50 USD', 1234.5],
    ['', 0],
  ])('%s → %d', (value, amount) => expect(parseAmount(value)).toBe(amount));
});

describe('parseDate', () => {
  it.each([
    ['October 22, 2026', '2026-10-22'],
    ['May 3, 2014', '2014-05-03'],
    ['Smarch 3, 2014', undefined],
    ['', undefined],
  ])('%s → %s', (value, date) => expect(parseDate(value)).toBe(date));
});

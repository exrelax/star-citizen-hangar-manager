// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buybackShipNames, hasSeveralItems, mainItem, type BuybackPledge } from './buyback';
import { giftableIdLimit, toBuybackView } from './buyback-view';
import { parseBuybackDetail, parseBuybackPage } from './parse-buyback';

// Trimmed-down copy of `/en/account/buy-back-pledges` with made-up values.
const entry = (id: number, title: string, contained: string, date: string, ccu = false) => `
  <li><article class="pledge"><div class="information">
    <figure><img src="https://media.example.com/${id}.jpg" alt="${title}" /></figure>
    <div>
      <div class="pledge-title-row"><h1 title="${title}">${title}</h1></div>
      <dl><dt>Reclaim Date</dt><dd>${date}</dd><dt>Contained</dt><dd>${contained}</dd></dl>
      <div class="buyback-action">${
        ccu
          ? `<a href="" class="holosmallbtn js-open-ship-upgrades" data-pledgeid="${id}"
              data-fromshipid="268" data-toshipid="5" data-toskuid="12991">Buy Back</a>`
          : `<a class="holosmallbtn" href="/pledge/buyback/${id}">Buy Back</a>`
      }</div>
    </div>
  </div></article></li>`;

const pageHtml = (entries: string, pages: number[]) => `
  <section class="available-pledges"><div class="js-buyback-results">
    <ul class="pledges">${entries}</ul>
    <div class="options-selector pager-wrapper">${pages
      .map((page) => `<a href="/en/account/buy-back-pledges?page=${page}&pagesize=250">${page}</a>`)
      .join('')}</div>
  </div></section>`;

const parse = (html: string) =>
  parseBuybackPage(new DOMParser().parseFromString(html, 'text/html'));

describe('parseBuybackPage', () => {
  it('reads regular pledges and CCUs with their ids', () => {
    const { pledges, lastPage } = parse(
      pageHtml(
        entry(
          60198372,
          'Standalone Ship - F8C Lightning',
          'F8C Lightning and 2 items',
          'November 29, 2025',
        ) +
          entry(
            112666100,
            'Upgrade - Pulse to Aurora LX Standard Edition',
            'Upgrade - Pulse to Aurora LX',
            'October 2, 2026',
            true,
          ),
        [1, 2, 16],
      ),
    );

    expect(lastPage).toBe(16);
    expect(pledges).toEqual([
      {
        id: 60198372,
        title: 'Standalone Ship - F8C Lightning',
        image: 'https://media.example.com/60198372.jpg',
        reclaimedAt: '2025-11-29',
        contained: 'F8C Lightning and 2 items',
        isUpgrade: false,
      },
      {
        id: 112666100,
        title: 'Upgrade - Pulse to Aurora LX Standard Edition',
        image: 'https://media.example.com/112666100.jpg',
        reclaimedAt: '2026-10-02',
        contained: 'Upgrade - Pulse to Aurora LX',
        isUpgrade: true,
        upgrade: { fromShipId: 268, toShipId: 5, toSkuId: 12991 },
      },
    ]);
  });
});

describe('parseBuybackDetail', () => {
  it('lists the items of the package', () => {
    const doc = new DOMParser().parseFromString(
      `<div class="buy-back-description"><p>comes with an exclusive lifetime insurance</p></div>
       <div class="package-listing item"><ul>
         <li>Fury - Leatherback Paint</li><li>Lifetime Insurance</li><li> </li>
       </ul></div>`,
      'text/html',
    );
    expect(parseBuybackDetail(doc)).toEqual(['Fury - Leatherback Paint', 'Lifetime Insurance']);
  });
});

describe('contained helpers', () => {
  it('splits the main item from the item count', () => {
    expect(hasSeveralItems({ contained: 'Fury and 4 items' })).toBe(true);
    expect(hasSeveralItems({ contained: 'Sabre - Blue Steel Paint' })).toBe(false);
    expect(mainItem({ contained: 'F8C Lightning and 2 items' })).toBe('F8C Lightning');
  });

  it('names ships only for ship pledges and packages', () => {
    const base = { id: 1, contained: 'Fury and 4 items', isUpgrade: false } as BuybackPledge;
    expect(buybackShipNames({ ...base, title: 'Standalone Ship - Fury' })).toEqual(['Fury']);
    expect(buybackShipNames({ ...base, title: 'Gear - Bundle' })).toEqual([]);
  });
});

describe('toBuybackView', () => {
  const pledge = (overrides: Partial<BuybackPledge>): BuybackPledge => ({
    id: 100,
    title: 'Standalone Ship - Fury',
    contained: 'Fury and 4 items',
    isUpgrade: false,
    ...overrides,
  });
  const view = (p: BuybackPledge, idLimit?: number) =>
    toBuybackView(p, { position: 0, idLimit, cutoff: '2026-10-30' });

  it('is probably giftable when melted before the cutoff or bought before it (by id)', () => {
    expect(view(pledge({ reclaimedAt: '2026-10-12' })).isProbablyGiftable).toBe(true);
    expect(view(pledge({ id: 500, reclaimedAt: '2026-11-01' }), 600).isProbablyGiftable).toBe(true);
    expect(view(pledge({ id: 700, reclaimedAt: '2026-11-01' }), 600).isProbablyGiftable).toBe(
      false,
    );
    expect(view(pledge({ reclaimedAt: '2026-11-01' })).isProbablyGiftable).toBe(false);
  });

  it('knows LTI and game access only from the detail items', () => {
    expect(view(pledge({ items: ['Fury', 'Lifetime Insurance'] })).hasLti).toBe(true);
    expect(view(pledge({ items: ['Fury', '120 Month Insurance'] })).hasLti).toBe(false);
    expect(view(pledge({})).hasLti).toBe(false);
    expect(view(pledge({ items: ['Star Citizen Digital Download'] })).hasGameAccess).toBe(true);
  });

  it('lists the main item before the detail items', () => {
    expect(view(pledge({ items: ['Lifetime Insurance', 'VFG Industrial Hangar'] })).items).toEqual([
      'Fury',
      'Lifetime Insurance',
      'VFG Industrial Hangar',
    ]);
  });

  it('recognizes paints and CCUs', () => {
    expect(
      view(
        pledge({
          title: 'Paints - Sabre - Blue Steel Paint',
          contained: 'Sabre - Blue Steel Paint',
        }),
      ).isPaint,
    ).toBe(true);
    expect(
      view(pledge({ title: 'Apollo Alliance Aid Red Livery', contained: 'Apollo - Red Livery' }))
        .isPaint,
    ).toBe(true);
    expect(
      view(pledge({ title: 'Upgrade - A to B', contained: 'Upgrade - A to B', isUpgrade: true }))
        .isCcu,
    ).toBe(true);
  });

  it('derives the buy back page from the position (250 per page)', () => {
    expect(toBuybackView(pledge({}), { position: 249, idLimit: undefined }).page).toBe(1);
    expect(toBuybackView(pledge({}), { position: 250, idLimit: undefined }).page).toBe(2);
  });
});

describe('giftableIdLimit', () => {
  it('takes the highest id created before the cutoff', () => {
    expect(
      giftableIdLimit(
        [
          { id: 900, createdAt: '2026-10-30' },
          { id: 800, createdAt: '2026-10-22' },
          { id: 700, createdAt: '2026-09-01' },
          { id: 650 },
        ],
        '2026-10-30',
      ),
    ).toBe(800);
    expect(giftableIdLimit([], '2026-10-30')).toBeUndefined();
  });
});

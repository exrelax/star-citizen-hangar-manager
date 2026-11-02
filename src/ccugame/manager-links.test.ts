// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { findPledgeId, syncManagerLinks } from './manager-links';

const panel = (pledgeId: string, page = 59) => `
  <div class="panel">
    <div class="grid">
      <div class="flex"><span class="icon"></span>
        <div class="mat-tooltip-trigger ml-6">${pledgeId}</div>
      </div>
      <div class="flex"><div class="mat-tooltip-trigger">exrelax</div></div>
    </div>
    <div class="flex"><span class="icon external"></span>
      <a class="hover:underline text-primary-500" target="_blank"
        href="https://robertsspaceindustries.com/connect?jumpto=${encodeURIComponent(
          `https://robertsspaceindustries.com/account/pledges?page=${page}`,
        )}"
      >https://robertsspaceindustries.com/account/pledges?page=${page}</a>
    </div>
  </div>`;

const managerLinks = () => [...document.querySelectorAll('[data-shm-manager-link] a')];

beforeEach(() => {
  document.body.innerHTML = panel('#62492122');
});

describe('findPledgeId', () => {
  it('finds the pledge id in the same details panel', () => {
    expect(findPledgeId(document.querySelector('a')!)).toBe(62492122);
  });

  it('ignores other tooltips', () => {
    document.body.innerHTML = panel('exrelax');
    expect(findPledgeId(document.querySelector('a')!)).toBeUndefined();
  });
});

describe('syncManagerLinks', () => {
  it('adds a manager link below the RSI link, in the same row style', () => {
    syncManagerLinks(document);

    const [link] = managerLinks();
    expect(link?.getAttribute('href')).toBe(
      'https://robertsspaceindustries.com/account/pledges?search=62492122#hangar-manager',
    );
    expect(link?.textContent).toBe('Open in Hangar Manager (#62492122)');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(
      link?.closest('[data-shm-manager-link]')?.querySelector('.icon.external'),
    ).not.toBeNull();
  });

  it('adds the link only once', () => {
    syncManagerLinks(document);
    syncManagerLinks(document);
    expect(managerLinks()).toHaveLength(1);
  });

  it('follows a changed pledge id (paging through grouped CCUs)', () => {
    syncManagerLinks(document);
    document.querySelector('.mat-tooltip-trigger.ml-6')!.textContent = '#62492123';
    syncManagerLinks(document);

    expect(managerLinks()).toHaveLength(1);
    expect(managerLinks()[0]?.textContent).toBe('Open in Hangar Manager (#62492123)');
  });

  it('adds nothing without a pledge id', () => {
    document.body.innerHTML = panel('exrelax');
    syncManagerLinks(document);
    expect(managerLinks()).toHaveLength(0);
  });
});

describe('buy back items', () => {
  const buybackPanel = (pledgeId: string) => `
    <div class="panel">
      <div class="grid"><div class="flex">
        <div class="mat-tooltip-trigger ml-6">${pledgeId}</div>
      </div></div>
      <div class="rows">
        <div class="flex"><span class="icon external"></span>
          <a target="_blank" href="https://robertsspaceindustries.com/connect?jumpto=${encodeURIComponent(
            'https://robertsspaceindustries.com/account/buy-back-pledges?pagesize=1&page=657',
          )}">https://robertsspaceindustries.com/account/buy-back-pledges?pagesize=1&page=657</a>
        </div>
        <div class="flex cart"><span class="icon cart"></span><button>Add to cart on RSI</button></div>
      </div>
    </div>`;

  it('adds a link to the buy back tab right before "Add to cart on RSI"', () => {
    document.body.innerHTML = buybackPanel('#87544255');
    syncManagerLinks(document);

    const row = document.querySelector('[data-shm-manager-link]')!;
    expect(row.nextElementSibling?.classList.contains('cart')).toBe(true);
    const link = row.querySelector('a')!;
    expect(link.getAttribute('href')).toBe(
      'https://robertsspaceindustries.com/account/pledges?search=87544255#hangar-manager-bb',
    );
    expect(link.textContent).toBe('Open in Hangar Manager – Buy Back (#87544255)');
  });

  it('finds "Add to cart on RSI" also behind other rows (paints)', () => {
    document.body.innerHTML = buybackPanel('#112666145').replace(
      '<div class="flex cart">',
      '<div class="flex store">In Store: Sabre - Blue Steel Paint</div><div class="flex cart">',
    );
    syncManagerLinks(document);
    syncManagerLinks(document);

    const rows = document.querySelectorAll('[data-shm-manager-link]');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.previousElementSibling?.classList.contains('store')).toBe(true);
    expect(rows[0]!.nextElementSibling?.classList.contains('cart')).toBe(true);
  });

  it('moves the link before "Add to cart on RSI" when that row appears later', () => {
    document.body.innerHTML = buybackPanel('#87544255');
    const cart = document.querySelector('.cart')!;
    cart.remove();
    syncManagerLinks(document);
    document.querySelector('[data-shm-manager-link]')!.after(cart);
    syncManagerLinks(document);

    const rows = document.querySelectorAll('[data-shm-manager-link]');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.nextElementSibling).toBe(cart);
  });

  it('adds the buy back link only once', () => {
    document.body.innerHTML = buybackPanel('#87544255');
    syncManagerLinks(document);
    syncManagerLinks(document);
    expect(managerLinks()).toHaveLength(1);
  });
});

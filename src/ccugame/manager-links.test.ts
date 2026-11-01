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

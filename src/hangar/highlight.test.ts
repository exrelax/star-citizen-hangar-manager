// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { directionOf, findPledgeItem, locatePledgePage, pageIds } from './highlight';
import type { Pledge } from './pledge';

const listHtml = (ids: number[]) =>
  `<ul class="list-items">${ids
    .map((id) => `<li><input type="hidden" class="js-pledge-id" value="${id}" /></li>`)
    .join('')}</ul>`;

describe('findPledgeItem / pageIds', () => {
  it('finds a pledge of the current page by id', () => {
    document.body.innerHTML = listHtml([300, 200, 100]);
    expect(pageIds(document)).toEqual([300, 200, 100]);
    expect(findPledgeItem(document, 200)).toBe(document.querySelectorAll('li')[1]);
    expect(findPledgeItem(document, 250)).toBeUndefined();
  });
});

describe('directionOf', () => {
  it('tells on which side of a page a pledge is', () => {
    expect(directionOf(400, [300, 200, 100])).toBe(-1);
    expect(directionOf(50, [300, 200, 100])).toBe(1);
    expect(directionOf(250, [300, 200, 100])).toBe(0);
  });
});

describe('locatePledgePage', () => {
  // Pages of 3 pledges: 1 = [900, 800, 700], 2 = [600, 500, 400], 3 = [300, 200, 100].
  const pages = [
    [900, 800, 700],
    [600, 500, 400],
    [300, 200, 100],
  ];
  const fetchPage = async (page: number) => ({
    pledges: pages[page - 1]!.map((id) => ({ id }) as Pledge),
    lastPage: pages.length,
  });

  it('finds the pledge on a later or earlier page', async () => {
    expect(await locatePledgePage(200, 1, 1, 3, fetchPage)).toBe(3);
    expect(await locatePledgePage(800, 3, -1, 3, fetchPage)).toBe(1);
  });

  it('gives up when the pledge is gone or too far away', async () => {
    expect(await locatePledgePage(550, 1, 1, 3, fetchPage)).toBeUndefined();
    expect(await locatePledgePage(200, 1, 1, 3, fetchPage, 1)).toBeUndefined();
    expect(await locatePledgePage(50, 2, 1, 3, fetchPage)).toBeUndefined();
  });
});

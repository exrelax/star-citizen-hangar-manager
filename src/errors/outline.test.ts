// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { outlineOf } from './outline';

const element = (html: string) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild!;
};

describe('outlineOf (#342)', () => {
  it('shows tags, classes and attribute names, nested, without texts or values', () => {
    const li = element(`
      <li class="row is-new" data-pledgeid="123456">
        <h1>Package - Fury Starter</h1>
        <a href="/pledge/buyback/123456" class="holosmallbtn">Buy back</a>
        <input type="hidden" name="js-pledge-id" value="123456">
      </li>`);
    expect(outlineOf(li)).toBe(
      [
        'li.row.is-new[data-pledgeid]',
        '  h1',
        '  a.holosmallbtn[href]',
        '  input[type][name]',
      ].join('\n'),
    );
    expect(outlineOf(li)).not.toMatch(/123456|Fury/);
  });

  it('stays within its length', () => {
    const list = element(`<ul>${'<li class="item"><span></span></li>'.repeat(200)}</ul>`);
    const outline = outlineOf(list, 100);
    expect(outline.length).toBeLessThanOrEqual(100);
    expect(outline.endsWith('…')).toBe(true);
  });
});

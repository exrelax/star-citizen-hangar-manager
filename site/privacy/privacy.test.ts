// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePrivacy, renderPrivacy } from './privacy.ts';

const MARKDOWN = `# Privacy Policy

**Hangar Manager** (browser extension)

Last updated: 6 November 2026

Your data stays in your browser.

## Who is responsible

A hobby project, see <https://github.com/exrelax>.

## Where the data is kept

- **In your browser only**, in \`storage.local\`.
- Settings & filters.

## Where the data is kept
`;

describe('parsePrivacy', () => {
  it('splits PRIVACY.md into title, meta line, summary and sections', () => {
    const page = parsePrivacy(MARKDOWN);
    expect(page.title).toBe('Privacy Policy');
    expect(page.meta).toBe('Hangar Manager (browser extension) · Last updated: 6 November 2026');
    expect(page.intro).toContain('Your data stays in your browser.');
    // Unique ids, also for sections with the same title.
    expect(page.sections.map((section) => section.id)).toEqual([
      'who-is-responsible',
      'where-the-data-is-kept',
      'where-the-data-is-kept-2',
    ]);
    expect(page.sections[1]!.html).toContain('<strong>In your browser only</strong>');
    expect(page.sections[1]!.html).toContain('<code>storage.local</code>');
  });

  it('reads the real PRIVACY.md, with the section about the website', () => {
    const page = parsePrivacy(readFileSync(join(import.meta.dirname, '../../PRIVACY.md'), 'utf8'));
    expect(page.title).toBe('Privacy Policy');
    expect(page.meta).toMatch(/Last updated: \d{1,2} \w+ \d{4}$/);
    expect(page.sections.map((section) => section.title)).toContain('This website');
  });
});

describe('renderPrivacy', () => {
  it('renders the title, a table of contents and the sections', () => {
    const html = renderPrivacy(parsePrivacy(MARKDOWN));
    const page = new DOMParser().parseFromString(html, 'text/html');

    expect(page.querySelector('h1')?.textContent).toBe('Privacy Policy');
    expect(page.querySelector('.privacy-intro')?.textContent?.trim()).toBe(
      'Your data stays in your browser.',
    );
    expect([...page.querySelectorAll('.privacy-toc a')].map((a) => a.getAttribute('href'))).toEqual(
      ['#who-is-responsible', '#where-the-data-is-kept', '#where-the-data-is-kept-2'],
    );
    expect(page.querySelector('#who-is-responsible a')?.getAttribute('href')).toBe(
      'https://github.com/exrelax',
    );
    expect(page.querySelector('#where-the-data-is-kept li:last-child')?.textContent).toBe(
      'Settings & filters.',
    );
  });
});

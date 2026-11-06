// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The site's pages and the URL each is published at.
const SITE_URL = 'https://exrelax.github.io/star-citizen-hangar-manager/';
const PAGES = [
  { file: 'index.html', url: SITE_URL },
  { file: 'privacy.html', url: `${SITE_URL}privacy.html` },
];

describe.each(PAGES)('meta tags of $file', ({ file, url }) => {
  const page = new DOMParser().parseFromString(
    readFileSync(join(import.meta.dirname, file), 'utf8'),
    'text/html',
  );
  const meta = (key: string) =>
    page.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.getAttribute('content');

  it('has a preview for social media, with the same texts as the page', () => {
    const title = page.querySelector('title')?.textContent;
    const description = meta('description');
    expect(title).toBeTruthy();
    expect(description).toBeTruthy();

    expect(page.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(url);
    expect(meta('og:url')).toBe(url);
    expect(meta('og:type')).toBe('website');
    expect(meta('og:title')).toBe(title);
    expect(meta('twitter:title')).toBe(title);
    expect(meta('og:description')).toBe(description);
    expect(meta('twitter:description')).toBe(description);
    expect(meta('twitter:card')).toBe('summary_large_image');
  });

  it('shows the social preview image, with its size and alt text', () => {
    // A relative path in the source; the build makes it absolute (see vite.config.ts).
    expect(meta('og:image')).toBe('../store/social-preview-1280x640.png');
    expect(meta('twitter:image')).toBe(meta('og:image'));
    expect([meta('og:image:width'), meta('og:image:height')]).toEqual(['1280', '640']);
    expect(meta('og:image:alt')).toBeTruthy();
    expect(meta('twitter:image:alt')).toBe(meta('og:image:alt'));
  });
});

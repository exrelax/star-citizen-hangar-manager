import { describe, expect, it } from 'vitest';
import { browserFamily, browserScript } from './browser.ts';

const UA = {
  chrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0',
  opera:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 OPR/134.0.0.0',
  vivaldi:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Vivaldi/8.1',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0',
  waterfox:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0 Waterfox/6.6.0',
  librewolf: 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0',
  safari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15',
  firefoxIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/150.0 Mobile/15E148 Safari/605.1.15',
};

describe('the browser family for the call to action', () => {
  it('knows Chrome and the browsers built on Chromium', () => {
    for (const userAgent of [UA.chrome, UA.edge, UA.opera, UA.vivaldi]) {
      expect(browserFamily(userAgent)).toBe('chromium');
    }
    // Brave and others may hide "Chrome" in the user agent, but not their brands.
    expect(browserFamily('Mozilla/5.0', [{ brand: 'Brave' }, { brand: 'Chromium' }])).toBe(
      'chromium',
    );
  });

  it('knows Firefox and the browsers built on it', () => {
    for (const userAgent of [UA.firefox, UA.waterfox, UA.librewolf]) {
      expect(browserFamily(userAgent)).toBe('firefox');
    }
  });

  it('leaves the others to the default', () => {
    expect(browserFamily(UA.safari)).toBe('other');
    expect(browserFamily(UA.firefoxIos)).toBe('other');
  });

  it('runs inlined, on its own', () => {
    const source = /^<script>(.*)<\/script>$/.exec(browserScript())![1]!;
    const html = { dataset: {} as Record<string, string> };
    new Function('document', 'navigator', source)(
      { documentElement: html },
      { userAgent: UA.waterfox },
    );
    expect(html.dataset.browser).toBe('firefox');
  });
});

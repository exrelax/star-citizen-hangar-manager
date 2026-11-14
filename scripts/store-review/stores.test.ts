import { describe, expect, it } from 'vitest';
import { compareVersions, readListing, STORES, UnexpectedAnswer } from './stores.ts';

// Recorded answers of 2026-11-14, shortened.
const CHROME_LISTED =
  '<?xml version="1.0" encoding="UTF-8"?><gupdate xmlns="http://www.google.com/update2/response" protocol="2.0" server="prod"><daystart elapsed_days="7257" elapsed_seconds="53079"/><app appid="nofhjnkljndooegpllppamacogkikdjg" cohort="1::" cohortname="" status="ok"><updatecheck _esbAllowlist="false" codebase="https://clients2.googleusercontent.com/crx/blobs/x.crx" fp="1.7d" hash_sha256="7d" protected="0" size="780524" status="ok" version="1.1.0"/></app></gupdate>';
const CHROME_UNKNOWN =
  '<?xml version="1.0" encoding="UTF-8"?><gupdate xmlns="http://www.google.com/update2/response" protocol="2.0" server="prod"><daystart elapsed_days="7257" elapsed_seconds="54551"/><app appid="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" status="error-unknownApplication"/></gupdate>';
const OPERA_LISTED =
  '<dl><dt>Downloads</dt><dd>15,576,014</dd><dt>Version</dt><dd>1.76.0</dd><dt>Size</dt><dd>5.6 MB</dd></dl>';

describe('the Chrome Web Store (#350)', () => {
  const parse = STORES.chrome.parse;

  it('reads the version and whether Enhanced Safe Browsing trusts the extension', () => {
    expect(parse(200, CHROME_LISTED)).toEqual({ version: '1.1.0', esbTrusted: false });
    expect(
      parse(200, CHROME_LISTED.replace('_esbAllowlist="false"', '_esbAllowlist="true"')),
    ).toEqual({ version: '1.1.0', esbTrusted: true });
  });

  it("knows an extension that isn't listed", () => {
    expect(parse(200, CHROME_UNKNOWN)).toBeUndefined();
  });

  it('fails on anything else', () => {
    expect(() => parse(500, '')).toThrow(UnexpectedAnswer);
    expect(() => parse(200, '<html>Sorry</html>')).toThrow(UnexpectedAnswer);
    expect(() => parse(200, CHROME_LISTED.replace('version="1.1.0"', 'version="x"'))).toThrow(
      UnexpectedAnswer,
    );
    expect(() =>
      parse(200, CHROME_LISTED.replace(' status="ok" version', ' status="noupdate" version')),
    ).toThrow(UnexpectedAnswer);
  });
});

describe('Firefox Add-ons (#350)', () => {
  const parse = STORES.firefox.parse;

  it('reads the current version of a public add-on', () => {
    const body = JSON.stringify({ status: 'public', current_version: { version: '1.1.0' } });
    expect(parse(200, body)).toEqual({ version: '1.1.0' });
  });

  it("knows an add-on that isn't listed or not public", () => {
    expect(parse(404, '{"detail":"Not found."}')).toBeUndefined();
    expect(
      parse(200, JSON.stringify({ status: 'disabled', current_version: null })),
    ).toBeUndefined();
  });

  it('fails on anything else', () => {
    expect(() => parse(503, '')).toThrow(UnexpectedAnswer);
    expect(() => parse(200, 'not json')).toThrow(UnexpectedAnswer);
    expect(() => parse(200, JSON.stringify({ status: 'public' }))).toThrow(UnexpectedAnswer);
  });
});

describe('Opera Add-ons (#350)', () => {
  const parse = STORES.opera.parse;

  it('reads the version of the listing page', () => {
    expect(parse(200, OPERA_LISTED)).toEqual({ version: '1.76.0' });
  });

  it("knows an extension that isn't approved yet", () => {
    expect(parse(404, '<html>Page not found</html>')).toBeUndefined();
  });

  it('fails on a page without the version', () => {
    expect(() => parse(200, '<html>Opera add-ons</html>')).toThrow(UnexpectedAnswer);
    expect(() => parse(429, '')).toThrow(UnexpectedAnswer);
  });
});

describe('Microsoft Edge Add-ons (#350)', () => {
  const parse = STORES.edge.parse;

  it('reads the version', () => {
    expect(parse(200, JSON.stringify({ name: 'uBlock Origin', version: '1.76.2' }))).toEqual({
      version: '1.76.2',
    });
  });

  it("knows an extension that isn't listed", () => {
    expect(parse(404, '')).toBeUndefined();
  });

  it('fails on anything else', () => {
    expect(() => parse(200, '{}')).toThrow(UnexpectedAnswer);
    expect(() => parse(500, '')).toThrow(UnexpectedAnswer);
  });
});

describe('reading a listing (#350)', () => {
  it('asks the store and parses its answer', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return new Response(CHROME_LISTED, { status: 200 });
    }) as typeof fetch;
    await expect(readListing(STORES.chrome, 'abc', fetchImpl)).resolves.toEqual({
      version: '1.1.0',
      esbTrusted: false,
    });
    expect(urls[0]).toContain('x=id%3Dabc%26uc');
  });

  it('reports a network failure as an unexpected answer', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    await expect(readListing(STORES.firefox, 'x', fetchImpl)).rejects.toThrow(UnexpectedAnswer);
  });
});

describe('comparing versions', () => {
  it('compares each part as a number', () => {
    expect(compareVersions('1.1.1', '1.1.0')).toBeGreaterThan(0);
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
    expect(compareVersions('1.0.9', '1.1.0')).toBeLessThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  fetchStoreVersions,
  outdatedStoreVersions,
  renderStoreVersions,
  shownStoreVersions,
} from './store-versions.ts';

const PAGE =
  '<a>Chrome</a><!-- store-version:chrome --><a>Firefox</a><!-- store-version:firefox -->' +
  '<a>Chrome</a><!-- store-version:chrome -->';

describe('the store versions below the buttons (#368)', () => {
  it('reads the version of each store', async () => {
    const fetchImpl = (async (url: string) =>
      url.startsWith('https://clients2.google.com/')
        ? new Response(
            '<gupdate><app appid="x" status="ok"><updatecheck status="ok" version="1.1.0"/></app></gupdate>',
          )
        : new Response(
            JSON.stringify({ status: 'public', current_version: { version: '1.1.1' } }),
          )) as typeof fetch;
    expect(await fetchStoreVersions(() => {}, fetchImpl)).toEqual({
      chrome: '1.1.0',
      firefox: '1.1.1',
    });
  });

  it('leaves out a store that fails or lists nothing, and tells why', async () => {
    const warnings: string[] = [];
    const fetchImpl = (async (url: string) =>
      url.startsWith('https://clients2.google.com/')
        ? new Response('maintenance', { status: 503 })
        : new Response('', { status: 404 })) as typeof fetch;
    expect(await fetchStoreVersions((warning) => warnings.push(warning), fetchImpl)).toEqual({});
    // The stores are asked at the same time.
    expect(warnings.toSorted()).toEqual([
      'Chrome Web Store: unexpected answer (HTTP 503)',
      "Firefox Add-ons doesn't list the extension.",
    ]);
  });

  it('renders each version below every button of its store, and nothing without one', () => {
    const page = renderStoreVersions(PAGE, { chrome: '1.1.1' });
    expect(page).not.toContain('<!--');
    expect(page.match(/data-store-version="chrome">Version 1\.1\.1</g)).toHaveLength(2);
    expect(page).not.toContain('firefox');
    expect(shownStoreVersions(page)).toEqual({ chrome: '1.1.1' });
  });

  it('finds the stores the website shows wrongly', () => {
    expect(
      outdatedStoreVersions(
        { chrome: '1.1.0', firefox: '1.1.1' },
        { chrome: '1.1.1', firefox: '1.1.1' },
      ),
    ).toEqual(['Chrome Web Store lists 1.1.1, the website 1.1.0']);
    // A line the site doesn't show, or a store that couldn't be read, counts for nothing.
    expect(outdatedStoreVersions({ chrome: '1.1.0' }, { firefox: '1.2.0' })).toEqual([]);
  });
});

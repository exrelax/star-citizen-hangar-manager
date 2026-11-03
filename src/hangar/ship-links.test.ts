import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { settingsItem } from '@/settings/settings';
import type { Pledge, PledgeItem } from './pledge';
import { createSlugIndex, matchFleetyardsSlug, resolveShipLinks } from './ship-links';

const index = createSlugIndex([
  'anvl-f8a-lightning',
  'anvl-f8c-lightning',
  'anvl-f8c-lightning-executive-edition',
  'aegs-avenger-titan',
  'aegs-avenger-titan-renegade',
  'crus-m2-hercules',
  'rsi-polaris',
  'drak-dragonfly-starkitten-edition',
]);

describe('matchFleetyardsSlug', () => {
  it('matches by manufacturer and name', () => {
    expect(matchFleetyardsSlug('F8C Lightning', 'ANVL', index)).toBe('anvl-f8c-lightning');
    expect(matchFleetyardsSlug('Polaris', 'RSI', index)).toBe('rsi-polaris');
  });

  it('prefers the most specific model', () => {
    expect(matchFleetyardsSlug('F8C Lightning Executive Edition', 'ANVL', index)).toBe(
      'anvl-f8c-lightning-executive-edition',
    );
    expect(matchFleetyardsSlug('Avenger Titan Renegade', 'AEGS', index)).toBe(
      'aegs-avenger-titan-renegade',
    );
  });

  it('ignores word order and extra words', () => {
    expect(matchFleetyardsSlug('Hercules Starlifter M2', 'CRUS', index)).toBe('crus-m2-hercules');
  });

  it('matches words that Fleetyards writes as one', () => {
    expect(matchFleetyardsSlug('Dragonfly Star Kitten Edition', 'DRAK', index)).toBe(
      'drak-dragonfly-starkitten-edition',
    );
  });

  it('does not match other manufacturers or unknown ships', () => {
    expect(matchFleetyardsSlug('Polaris', 'ANVL', index)).toBeUndefined();
    expect(matchFleetyardsSlug('Carrack', 'ANVL', index)).toBeUndefined();
  });
});

describe('resolveShipLinks', () => {
  beforeEach(() => fakeBrowser.reset());

  const ship = (title: string, manufacturerCode: string): PledgeItem => ({
    title,
    kind: 'Ship',
    manufacturerCode,
  });
  const pledges = [
    { items: [ship('F8C Lightning', 'ANVL'), { title: 'Paint', kind: 'Skin' }] },
    { items: [ship('Polaris', 'RSI'), ship('Unknown Ship', 'XXXX')] },
  ] as Pledge[];

  it('links ships and only fetches erkul ids that are not known yet', async () => {
    const fetchErkulIds = vi.fn(async (slugs: string[]) =>
      Object.fromEntries(slugs.map((slug) => [slug, `erkul_${slug}`])),
    );
    const links = await resolveShipLinks(
      pledges,
      { 'F8C Lightning': { fleetyards: 'anvl-f8c-lightning', erkul: 'anvl_lightning_f8c' } },
      { fetchSlugs: async () => index.map((entry) => entry.slug), fetchErkulIds },
    );

    expect(links).toEqual({
      'F8C Lightning': { fleetyards: 'anvl-f8c-lightning', erkul: 'anvl_lightning_f8c' },
      Polaris: { fleetyards: 'rsi-polaris', erkul: 'erkul_rsi-polaris' },
    });
    expect(fetchErkulIds).toHaveBeenCalledWith(['rsi-polaris']);
  });

  it('asks Fleetyards nothing while both links are turned off, and keeps the known ones', async () => {
    await settingsItem.setValue({ shipLinks: { erkul: false, fleetyards: false } });
    const source = { fetchSlugs: vi.fn(async () => []), fetchErkulIds: vi.fn(async () => ({})) };
    const previous = { Polaris: { fleetyards: 'rsi-polaris' } };

    expect(await resolveShipLinks(pledges, previous, source)).toBe(previous);
    expect(source.fetchSlugs).not.toHaveBeenCalled();
    expect(source.fetchErkulIds).not.toHaveBeenCalled();
  });
});

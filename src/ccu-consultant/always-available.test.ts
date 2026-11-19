import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '@/settings/settings';
import { createShipFactsLookup, type ShipFacts } from '@/ships/ship-facts';
import {
  alwaysAvailableSources,
  chosenAlwaysAvailableSource,
  countsAsAlwaysAvailable,
} from './always-available';

const facts = (sources: ShipFacts['sources']): ShipFacts =>
  ({
    revision: 1,
    changedAt: '2026-11-18T00:00:00Z',
    generatedAt: '2026-11-18T00:00:00Z',
    sources,
    ships: [
      { id: 1, name: 'Aurora MR', alwaysAvailable: [{ from: '2020-01-01' }], retired: [] },
      { id: 2, name: 'Idris-P', alwaysAvailable: [], retired: [] },
    ],
  }) as unknown as ShipFacts;

const wiki = {
  id: 'wiki',
  name: 'Star Citizen Wiki',
  url: 'https://w',
  facts: ['alwaysAvailable'],
};
const matrix = { id: 'matrix', name: 'RSI Ship Matrix', url: 'https://m', facts: ['name'] };
const other = { id: 'other', name: 'Other list', url: 'https://o', facts: ['alwaysAvailable'] };

const settings = (ccuConsultant: Partial<Settings['ccuConsultant']> = {}) => ({
  ccuConsultant: { ...DEFAULT_SETTINGS.ccuConsultant, ...ccuConsultant },
});

describe('always available ships of the CCU Consultant (#110)', () => {
  const lookup = createShipFactsLookup(facts([matrix, wiki, other]));

  it('offers only the sources that tell which ships are always available', () => {
    expect(alwaysAvailableSources(lookup).map((source) => source.id)).toEqual(['wiki', 'other']);
    expect(alwaysAvailableSources(undefined)).toEqual([]);
  });

  it('takes the chosen source, else the first one', () => {
    expect(chosenAlwaysAvailableSource(settings(), lookup)?.id).toBe('wiki');
    expect(
      chosenAlwaysAvailableSource(settings({ alwaysAvailableSource: 'other' }), lookup)?.id,
    ).toBe('other');
    expect(
      chosenAlwaysAvailableSource(settings({ alwaysAvailableSource: 'gone' }), lookup)?.id,
    ).toBe('wiki');
  });

  it('counts a ship only while the setting is on', () => {
    const wikiOnly = createShipFactsLookup(facts([matrix, wiki]));
    expect(countsAsAlwaysAvailable(settings(), wikiOnly, 1)).toBe(true);
    expect(countsAsAlwaysAvailable(settings(), wikiOnly, 2)).toBe(false);
    expect(countsAsAlwaysAvailable(settings(), wikiOnly, undefined)).toBe(false);
    expect(countsAsAlwaysAvailable(settings(), undefined, 1)).toBe(false);
    expect(countsAsAlwaysAvailable(settings({ considerAlwaysAvailable: false }), wikiOnly, 1)).toBe(
      false,
    );
  });
});

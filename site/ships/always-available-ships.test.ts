import { describe, expect, it } from 'vitest';
import siteFile from '../public/data/always-available-ships.json';
import {
  brokenReason,
  buildFile,
  createMatcher,
  MIN_SHIPS,
  parseShipMatrix,
  parseWiki,
  serialize,
  SOURCE,
} from './always-available-ships.ts';

const MATRIX = [
  { id: 159, name: '100i' },
  { id: 44, name: 'C8R Pisces' },
  { id: 45, name: 'C8X Pisces Expedition' },
  { id: 70, name: 'Dragonfly Black' },
  { id: 71, name: 'Dragonfly Yellowjacket' },
  { id: 189, name: 'Freelancer MAX' },
  { id: 190, name: 'Freelancer MIS' },
];

describe('parseWiki (#107)', () => {
  it('keeps the always available ships, each once, by name', () => {
    expect(
      parseWiki({
        bucket: [
          { page_name: 'Freelancer MAX', pledge_availability: 'Always available' },
          { page_name: 'Freelancer MIS', pledge_availability: 'Time-limited sales' },
          { page_name: '100i ', pledge_availability: 'Always available' },
          { page_name: '100i', pledge_availability: 'Always available' },
          { pledge_availability: 'Always available' },
        ],
      }),
    ).toEqual(['100i', 'Freelancer MAX']);
  });

  it('fails without data', () => {
    expect(() => parseWiki({ error: { code: 'ratelimited' } })).toThrow();
    expect(() => parseShipMatrix({ data: [] })).toThrow();
  });
});

describe('createMatcher', () => {
  const match = createMatcher(MATRIX);

  it('matches exactly, case and punctuation aside', () => {
    expect(match('Freelancer Max')?.id).toBe(189);
    expect(match('100i')?.id).toBe(159);
  });

  it('matches the only name either contains, not an ambiguous one', () => {
    expect(match('C8R Pisces Rescue')?.id).toBe(44);
    expect(match('Dragonfly')).toBeUndefined();
    expect(match('Polaris')).toBeUndefined();
  });
});

describe('buildFile', () => {
  it('names the source and its license and lists the unmatched ships', () => {
    const { file, unmatched } = buildFile(
      ['C8R Pisces Rescue', 'Dragonfly'],
      MATRIX,
      '2026-11-12T00:00:00.000Z',
    );
    expect(file).toEqual({
      schemaVersion: 1,
      generatedAt: '2026-11-12T00:00:00.000Z',
      sources: [SOURCE],
      ships: [
        { name: 'C8R Pisces Rescue', upgradeToolId: 44, sources: ['starcitizen-tools'] },
        { name: 'Dragonfly', sources: ['starcitizen-tools'] },
      ],
    });
    expect(unmatched).toEqual(['Dragonfly']);
    expect(SOURCE.license).toBe('CC BY-SA 4.0');
  });

  it('writes lists of strings on one line, as Prettier does', () => {
    const { file } = buildFile(['100i'], MATRIX, 'now');
    expect(serialize(file)).toContain('"sources": ["starcitizen-tools"]');
    expect(serialize(file).endsWith('}\n')).toBe(true);
  });
});

describe('brokenReason', () => {
  it('rejects a list that is too short or far shorter than before', () => {
    expect(brokenReason(MIN_SHIPS - 1, undefined)).toBeDefined();
    expect(brokenReason(30, 48)).toBeDefined();
    expect(brokenReason(45, 48)).toBeUndefined();
    expect(brokenReason(MIN_SHIPS, undefined)).toBeUndefined();
  });
});

describe('the published file', () => {
  it('has the format the extension reads', () => {
    expect(siteFile.schemaVersion).toBe(1);
    expect(siteFile.ships.length).toBeGreaterThanOrEqual(MIN_SHIPS);
    expect(siteFile.sources[0]?.license).toBe('CC BY-SA 4.0');
  });
});

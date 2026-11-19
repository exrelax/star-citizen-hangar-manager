import { describe, expect, it } from 'vitest';
import { isForOwnedShip, ownedShips, paintRefinement, paintShipWords } from './paint-ships';

describe('paints by the ships they are for (#336)', () => {
  it('reads the ship from a paint’s title', () => {
    expect(paintShipWords('Paints - Sabre - Ashcloud Paint')).toEqual(['sabre']);
    expect(paintShipWords('Constellation Mk V - Blackthorn Paint')).toEqual([
      'constellation',
      'mk',
      'v',
    ]);
    expect(paintShipWords('Paints - Intrepid - Oblivion')).toEqual(['intrepid']);
    // "Series" names the family, not a ship.
    expect(paintShipWords('Constellation Series - Ghoulish Green Paint')).toEqual([
      'constellation',
    ]);
    expect(paintShipWords('Paints - Holiday Pack')).toBeUndefined();
    expect(paintShipWords('Meridian Paint')).toBeUndefined();
  });

  const owned = ownedShips([
    'Sabre Comet',
    'C1 Spirit',
    'Constellation Andromeda',
    'Fury MX',
    'Fury MX',
    'C8R Pisces',
    '100i',
    'MTC',
  ]);

  it('fits every ship whose name has the paint’s ship in it', () => {
    expect(owned).toHaveLength(7);
    expect(isForOwnedShip(['Paints - Sabre - Ashcloud Paint'], owned)).toBe(true);
    expect(isForOwnedShip(['Spirit - Allegiant Paint'], owned)).toBe(true);
    expect(isForOwnedShip(['Constellation Series - Ghoulish Green Paint'], owned)).toBe(true);
    expect(isForOwnedShip(['Fury - Templar Paint'], owned)).toBe(true);
    // Words in another order or only some of them don't fit.
    expect(isForOwnedShip(['Constellation Mk V - Blackthorn Paint'], owned)).toBe(false);
    expect(isForOwnedShip(['Perseus - Hieron Paint'], owned)).toBe(false);
    // A model code names the models after it, but other words must be whole.
    expect(isForOwnedShip(['Paints - C8 Pisces - Code Blue Paint'], owned)).toBe(true);
    expect(isForOwnedShip(['100 Series - Melrose Paint - Imperator'], owned)).toBe(true);
    expect(isForOwnedShip(['Fur - Odd Paint'], owned)).toBe(false);
    // Without its ship before its name: an owned ship named in the title.
    expect(isForOwnedShip(['MTC Citizens for Prosperity Liberation Livery'], owned)).toBe(true);
    expect(isForOwnedShip(['RAFT Alliance Aid Green Livery'], owned)).toBe(false);
    // A paint that fits no owned ship this way.
    expect(isForOwnedShip(['Paints - Holiday Pack'], owned)).toBe(false);
  });

  it('counts a pledge with several paints as for owned ships once one fits', () => {
    expect(
      isForOwnedShip(
        ['Paints - Holiday Pack', 'Perseus - Hieron Paint', 'Sabre - Firebreak'],
        owned,
      ),
    ).toBe(true);
  });

  it('offers all paints, those for owned ships and those for ships not owned', () => {
    const options = paintRefinement<string>(owned, (title) => [title]);
    expect(options.map((option) => [option.id, option.label, option.short])).toEqual([
      ['all', 'All paints', undefined],
      ['owned', 'For owned ships', 'Owned ships'],
      ['notOwned', 'For ships not owned', 'Ships not owned'],
    ]);
    expect(options[1]!.matches!('Sabre - Ashcloud Paint')).toBe(true);
    expect(options[2]!.matches!('Sabre - Ashcloud Paint')).toBe(false);
    expect(options[2]!.matches!('Paints - Holiday Pack')).toBe(true);
  });
});

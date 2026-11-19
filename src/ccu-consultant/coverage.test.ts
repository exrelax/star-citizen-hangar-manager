import { describe, expect, it } from 'vitest';
import type { Ship } from '@/ships/ships';
import { ccuCoverage, type CoverageInput } from './coverage';

const ships: Ship[] = [
  { id: 1, name: 'Aurora MR', msrp: 25 },
  { id: 2, name: 'Mustang Alpha', msrp: 30 },
  { id: 3, name: 'Avenger Titan', msrp: 55 },
  { id: 4, name: 'Cutlass Black', msrp: 110 },
  { id: 5, name: 'Constellation Mk IV Andromeda', msrp: 260 },
];

type Hangar = CoverageInput['hangar'][number];
type Buyback = CoverageInput['buyback'][number];

const ccu = (id: number, from: string, to: string): Hangar => ({
  id,
  title: `Upgrade - ${from} to ${to} Standard Edition`,
  isCcu: true,
  upgrade: {
    matchItems: [{ id: 900 + id, name: from }],
    targetItems: [{ id: 800 + id, name: to }],
    type: 'R',
  },
  items: [],
});
const pledge = (id: number, title: string, shipTitles: string[]): Hangar => ({
  id,
  title,
  isCcu: false,
  items: shipTitles.map((ship) => ({ title: ship, kind: 'Ship' })),
});
const buybackShip = (id: number, title: string, names: string[]): Buyback => ({
  id,
  title,
  isCcu: false,
  ships: names.map((name) => ({ name })),
});
const buybackCcu = (
  id: number,
  title: string,
  upgrade?: { fromShipId: number; toShipId: number },
  unavailable = false,
): Buyback => ({
  id,
  title,
  isCcu: true,
  ships: [],
  ...(upgrade && { upgrade: { ...upgrade, toSkuId: 1 } }),
  ...(unavailable && {
    unavailable: {
      from: { name: 'Cutlass Black', msrp: 110 },
      to: { name: 'Avenger Titan', msrp: 55 },
    },
  }),
});

const coverage = (input: Partial<CoverageInput>) =>
  ccuCoverage({ ships, hangar: [], buyback: [], ...input });

describe('ccuCoverage (#108)', () => {
  it('is not covered without anything that gives the base ship', () => {
    const result = coverage({ hangar: [ccu(10, 'Avenger Titan', 'Cutlass Black')] }).get(10)!;
    expect(result.covered).toBe(false);
    expect(result.baseShip).toEqual({ id: 3, name: 'Avenger Titan' });
    expect(result.hangar).toEqual({ ships: [], ccus: [] });
    expect(result.buyback).toEqual({ ships: [], ccus: [] });
  });

  it('is covered by a standalone ship and by a package with it', () => {
    const result = coverage({
      hangar: [
        ccu(10, 'Avenger Titan', 'Cutlass Black'),
        pledge(20, 'Standalone Ships - Avenger Titan', ['Avenger Titan']),
        // Two of the same ship in one package count once.
        pledge(21, 'Package - Titan Pack', ['Avenger Titan', 'Avenger Titan', 'Aurora MR']),
        pledge(22, 'Standalone Ships - Mustang Alpha', ['Mustang Alpha']),
      ],
    }).get(10)!;
    expect(result.covered).toBe(true);
    expect(result.hangar.ships.map((match) => match.id)).toEqual([20, 21]);
  });

  it('is covered by an upgraded pledge whose current ship is the base ship', () => {
    // RSI lists the current ship of an upgraded pledge, here the Titan of a former Aurora.
    const upgraded = pledge(20, 'Package - Aurora MR Starter Pack', ['Avenger Titan']);
    const result = coverage({ hangar: [ccu(10, 'Avenger Titan', 'Cutlass Black'), upgraded] });
    expect(result.get(10)!.hangar.ships.map((match) => match.id)).toEqual([20]);
  });

  it('is covered by a hangar CCU to the base ship, and a CCU never covers itself', () => {
    const result = coverage({
      hangar: [ccu(10, 'Avenger Titan', 'Cutlass Black'), ccu(11, 'Aurora MR', 'Avenger Titan')],
    });
    expect(result.get(10)!.hangar.ccus.map((match) => match.id)).toEqual([11]);
    expect(result.get(10)!.covered).toBe(true);
    // The Aurora CCU has no Aurora: its own target doesn't count for itself.
    expect(result.get(11)!.covered).toBe(false);
  });

  it('is covered by a buy back ship and by a buy back CCU RSI can sell again', () => {
    const result = coverage({
      hangar: [ccu(10, 'Avenger Titan', 'Cutlass Black')],
      buyback: [
        buybackShip(30, 'Avenger Titan', ['Avenger Titan']),
        // By the ids on its button.
        buybackCcu(31, 'Upgrade - Aurora to Titan', { fromShipId: 1, toShipId: 3 }),
        // By its title, without structured data.
        buybackCcu(32, 'Upgrade - Mustang Alpha to Avenger Titan Warbond Edition'),
        // RSI can't sell it again: it doesn't cover anything.
        buybackCcu(33, 'Upgrade - Cutlass Black to Avenger Titan', undefined, true),
      ],
    }).get(10)!;
    expect(result.buyback.ships.map((match) => match.id)).toEqual([30]);
    expect(result.buyback.ccus.map((match) => match.id)).toEqual([31, 32]);
    expect(result.covered).toBe(true);
  });

  it("matches RSI's other names by the upgrade tool's ships", () => {
    const result = coverage({
      hangar: [
        ccu(10, 'Constellation Andromeda', 'Cutlass Black'),
        pledge(20, 'Standalone Ships - Constellation Mk IV Andromeda', [
          'Constellation Mk IV Andromeda',
        ]),
      ],
    }).get(10)!;
    expect(result.baseShip).toEqual({ id: 5, name: 'Constellation Andromeda' });
    expect(result.covered).toBe(true);
  });

  it('compares the words of names the upgrade tool doesn’t know', () => {
    const result = coverage({
      ships: [],
      hangar: [ccu(10, 'Hull A', 'Hull B'), pledge(20, 'Standalone Ships - Hull A', ['hull a'])],
    }).get(10)!;
    expect(result.baseShip).toEqual({ name: 'Hull A' });
    expect(result.covered).toBe(true);
  });

  it('reads the base ship from the title of a CCU without upgrade data', () => {
    const titleOnly: Hangar = {
      id: 10,
      title: 'Upgrade - Mustang Alpha to Avenger Titan Standard Edition',
      isCcu: true,
      items: [],
    };
    const result = coverage({
      hangar: [titleOnly, pledge(20, 'Standalone Ships - Mustang Alpha', ['Mustang Alpha'])],
    }).get(10)!;
    expect(result.baseShip).toEqual({ id: 2, name: 'Mustang Alpha' });
    expect(result.covered).toBe(true);
  });

  it('has an entry for every CCU of the hangar and none for other pledges', () => {
    const result = coverage({
      hangar: [
        ccu(10, 'Avenger Titan', 'Cutlass Black'),
        ccu(11, 'Aurora MR', 'Mustang Alpha'),
        pledge(20, 'Standalone Ships - Avenger Titan', ['Avenger Titan']),
      ],
    });
    expect([...result.keys()]).toEqual([10, 11]);
  });
});

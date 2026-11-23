import { describe, expect, it } from 'vitest';
import type { HangarSnapshot, Pledge, PledgeItem } from '@/hangar/pledge';
import { BOM } from './csv';
import { buildHangarExport } from './hangar-export';
import {
  buildHangarXplorExport,
  hangarXplorCsv,
  shipCodeOf,
  shipNameOf,
} from './hangarxplor-export';

/* The hangar export in HangarXPLOR's format, for FleetYards (#228). */

const NOW = new Date('2026-11-23T12:00:00Z');

const ship = (title: string, manufacturer: string, manufacturerCode: string): PledgeItem => ({
  title,
  kind: 'Ship',
  manufacturer,
  manufacturerCode,
});

const pledges = [
  {
    id: 201,
    name: 'Package - Two ships Warbond',
    value: '$350.00 USD',
    createdAt: '2026-03-04',
    items: [
      ship('Cutlass Black', 'Drake Interplanetary', 'DRAK'),
      ship('Anvil Arrow', 'Anvil Aerospace', 'ANVL'),
      { title: 'Lifetime Insurance', kind: 'Insurance' },
      { title: 'Star Citizen Digital Download', kind: 'Hangar decoration' },
    ],
  },
  {
    id: 202,
    name: 'Paint - Ghoulish Green',
    value: '$5.00 USD',
    items: [{ title: 'Ghoulish Green', kind: 'Skin' }],
  },
  {
    id: 203,
    name: 'Standalone Ships - Zeus Mk II ES',
    value: '$150.00 USD',
    createdAt: '2026-10-01',
    items: [
      ship('Zeus Mk II ES', 'Roberts Space Industries', 'RSI'),
      { title: '120 Month Insurance', kind: 'Insurance' },
    ],
  },
] as unknown as Pledge[];

const file = (options = {}) =>
  buildHangarExport(
    {
      hangar: { version: 3, syncedAt: '', pledges } as HangarSnapshot,
      buyback: null,
      orders: null,
      storeCredit: null,
      giftFlags: null,
    },
    options,
    NOW,
    '1',
  );

describe('shipNameOf and shipCodeOf', () => {
  it('drop the manufacturer in front of the name', () => {
    expect(shipNameOf(ship('Anvil Arrow', 'Anvil Aerospace', 'ANVL'))).toBe('Arrow');
    expect(shipNameOf(ship('RSI Zeus Mk II ES', 'Roberts Space Industries', 'RSI'))).toBe(
      'Zeus Mk II ES',
    );
    expect(shipNameOf(ship('Cutlass Black', 'Drake Interplanetary', 'DRAK'))).toBe('Cutlass Black');
  });

  it('build the code like HangarXPLOR', () => {
    expect(shipCodeOf('RSI', 'Aurora Mk I ES')).toBe('RSI_Aurora_Mk_I_ES');
    expect(shipCodeOf('ANVL', 'F7C-M Super Hornet')).toBe('ANVL_F7C_M_Super_Hornet');
  });
});

describe('buildHangarXplorExport', () => {
  it('writes one entry per ship, sorted by manufacturer and name', () => {
    const { ships } = buildHangarXplorExport(file());
    expect(ships).toEqual([
      {
        ship_code: 'ANVL_Arrow',
        ship_name: 'Arrow',
        manufacturer_code: 'ANVL',
        manufacturer_name: 'Anvil Aerospace',
        name: 'Arrow',
        lti: true,
        warbond: true,
        entity_type: 'ship',
        pledge_id: '201',
        pledge_name: 'Package - Two ships Warbond',
        pledge_date: 'March 4, 2026',
        pledge_cost: '$350.00 USD',
      },
      expect.objectContaining({ name: 'Cutlass Black', pledge_id: '201', lti: true }),
      expect.objectContaining({
        name: 'Zeus Mk II ES',
        ship_code: 'RSI_Zeus_Mk_II_ES',
        lti: false,
        warbond: false,
        pledge_date: 'October 1, 2026',
      }),
    ]);
  });

  it('names the ships the extension does not know', () => {
    const { unmatched } = buildHangarXplorExport(file(), [
      { name: 'Arrow' },
      { name: 'Cutlass Black' },
    ]);
    expect(unmatched).toEqual(['Zeus Mk II ES']);
    // Without a ship list nothing can be told apart.
    expect(buildHangarXplorExport(file()).unmatched).toEqual([]);
  });

  it('leaves out what the JSON export leaves out', () => {
    const { ships } = buildHangarXplorExport(file({ hideIds: true, hideAmounts: true }));
    expect(ships.map((entry) => entry.pledge_id)).toEqual(['1', '1', '3']);
    expect(ships.every((entry) => entry.pledge_cost === '')).toBe(true);
  });
});

describe('hangarXplorCsv', () => {
  it('has the columns of HangarXPLOR', () => {
    const csv = hangarXplorCsv(buildHangarXplorExport(file()).ships);
    expect(csv.slice(BOM.length).split('\r\n').slice(0, 2)).toEqual([
      'Manufacturer,Ship,Lti,Warbond,ID,Pledge,Cost,Date',
      'Anvil Aerospace,Arrow,true,true,201,Package - Two ships Warbond,$350.00 USD,"March 4, 2026"',
    ]);
  });
});

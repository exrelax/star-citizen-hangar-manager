// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BuybackPledge } from '@/buyback/buyback';
import type { Pledge } from '@/hangar/pledge';
import type { Ship } from './ships';
import { createBaseShipCounts } from './upgrade-dialog-counts';
import {
  applyLabels,
  watchUpgradeDialog,
  type UpgradeDialogOptions,
} from './upgrade-dialog-labels';

/* The counts on the base ships of RSI's ship upgrade dialog (#506). */

const ships: Ship[] = [
  { id: 1, name: 'Aurora MR', msrp: 25 },
  { id: 36, name: 'Cutlass Black', msrp: 110 },
  { id: 37, name: 'Cutlass Red', msrp: 135 },
  { id: 116, name: 'Polaris', msrp: 975 },
];

const pledge = (id: number, items: Pledge['items'], upgrade?: Pledge['upgrade']): Pledge =>
  ({ id, title: `Pledge ${id}`, items, ...(upgrade && { upgrade }) }) as Pledge;
const ccu = (id: number, from: Ship, to: Ship) =>
  pledge(id, [{ title: `Upgrade - ${from.name} to ${to.name}` }], {
    matchItems: [{ id: from.id, name: from.name }],
    targetItems: [{ id: to.id, name: to.name }],
    type: 'R',
  });
const buybackCcu = (id: number, from: Ship, to: Ship): BuybackPledge => ({
  id,
  title: `Upgrade - ${from.name} to ${to.name} Standard Edition`,
  contained: `Upgrade - ${from.name} to ${to.name}`,
  isUpgrade: true,
  upgrade: { fromShipId: from.id, toShipId: to.id } as BuybackPledge['upgrade'],
});
const [aurora, black, red, polaris] = ships as [Ship, Ship, Ship, Ship];

const hangar = [
  pledge(1, [{ title: 'Cutlass Red', kind: 'Ship' }]),
  // A package with two of them counts once.
  pledge(2, [
    { title: 'Cutlass Red', kind: 'Ship' },
    { title: 'Cutlass Red', kind: 'Ship' },
  ]),
  ccu(3, black, red),
  ccu(4, red, polaris),
];
const buyback = [
  buybackCcu(10, aurora, red),
  buybackCcu(11, black, red),
  // RSI can't sell this one again: its base costs as much as its target or more.
  buybackCcu(12, polaris, red),
];

describe('createBaseShipCounts', () => {
  it('counts owned ships and CCUs to the ship in the hangar and the buy back', () => {
    const countsOf = createBaseShipCounts({ ships, hangar, buyback });
    expect(countsOf({ id: 37, name: 'Cutlass Red' })).toEqual({
      owned: 2,
      hangarCcus: 1,
      buybackCcus: 2,
    });
    // By name without an id; nothing for a ship with nothing.
    expect(countsOf({ name: 'Cutlass Red' })).toEqual(countsOf({ id: 37 }));
    expect(countsOf({ id: 1 })).toEqual({ owned: 0, hangarCcus: 0, buybackCcus: 0 });
  });

  it('knows nothing of unknown ships, or without a stored hangar', () => {
    expect(createBaseShipCounts({ ships, hangar, buyback })({ name: 'Idris-P' })).toBeUndefined();
    expect(createBaseShipCounts({ ships, buyback })({ id: 37 })).toBeUndefined();
  });

  it('leaves out the buy back while it isn’t stored', () => {
    expect(createBaseShipCounts({ ships, hangar })({ id: 37 })).toEqual({
      owned: 2,
      hangarCcus: 1,
    });
  });
});

/** An item of the dialog's base ship list, as RSI renders it. */
const item = (name: string, id: number) => `
  <div class="ColumnsLayout ShipItem small" data-store-action-label="Select ${name} (id: ${id}) as from ship">
    <div class="clipper ShipItem-thumbnail-clip"><div class="clipper__content"></div></div>
    <div class="ShipItem-general-information-content">
      <h3 class="ShipItem-title"><span class="ShipItem-general-information-name">${name}</span></h3>
      <p class="ShipItem-general-information-focus">combat</p>
    </div>
    <div class="ShipItem-general-information-status-and-stock"></div>
  </div>`;
const dialog = (from: string, to = '') => {
  document.body.innerHTML = `<aside class="ShipUpgradeModal">
    <div class="ShipSelector from">${from}</div><div class="ShipSelector to">${to}</div></aside>`;
};
const countsOf = createBaseShipCounts({ ships, hangar, buyback });
const options = (on = true): UpgradeDialogOptions => ({
  enabled: () => false,
  isAlwaysAvailable: () => false,
  texts: () => ({ label: '', hint: '' }),
  countsOf: (target) => {
    const counts = on ? countsOf(target) : undefined;
    return counts && { text: `Owned ${counts.owned}`, hint: 'From the Hangar Manager' };
  },
  onMismatch: vi.fn(),
});
const lines = () =>
  [...document.querySelectorAll('.shm-base-counts')].map((line) => line.textContent);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the counts in the dialog', () => {
  it('shows them on the image of the base ships only', () => {
    dialog(item('Cutlass Red', 37) + item('Aurora MR', 1), item('Polaris', 116));
    applyLabels(document, options());
    expect(lines()).toEqual(['Owned 2', 'Owned 0']);
    const line = document.querySelector('.shm-base-counts')!;
    expect(line.parentElement?.className).toBe('clipper ShipItem-thumbnail-clip');
    expect(line.getAttribute('title')).toBe('From the Hangar Manager');
    expect(document.querySelector('.ShipSelector.to .shm-base-counts')).toBeNull();
  });

  it('follows a reused item and goes when turned off', () => {
    dialog(item('Cutlass Red', 37));
    applyLabels(document, options());
    applyLabels(document, options());
    expect(lines()).toEqual(['Owned 2']);
    const entry = document.querySelector('.ShipItem')!;
    entry.setAttribute('data-store-action-label', 'Select Aurora MR (id: 1) as from ship');
    applyLabels(document, options());
    expect(lines()).toEqual(['Owned 0']);
    applyLabels(document, options(false));
    expect(lines()).toEqual([]);
  });

  it('tells when the dialog opens, and reports a base ship list without its place', async () => {
    const onOpen = vi.fn();
    const watched = { ...options(), onOpen };
    dialog('<div class="ColumnsLayout ShipItem small"><h3>Cutlass Red</h3></div>');
    const stop = watchUpgradeDialog(document, watched);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(watched.onMismatch).toHaveBeenCalledWith('no ship id or name');
    stop.stop();
  });
});

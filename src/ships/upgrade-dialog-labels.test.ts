// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShipFactsLookup, type ShipFacts } from './ship-facts';
import {
  applyLabels,
  createAlwaysAvailableCheck,
  targetOf,
  watchUpgradeDialog,
  type UpgradeDialogOptions,
  type UpgradeTarget,
} from './upgrade-dialog-labels';

/* The label "Always available" in RSI's ship upgrade dialog (#401). */

const facts: ShipFacts = {
  changedAt: '2026-11-12',
  sources: [
    {
      id: 'wiki',
      name: 'Star Citizen Wiki',
      url: 'https://starcitizen.tools',
      facts: ['alwaysAvailable'],
    },
  ],
  ships: [
    {
      id: 65,
      name: 'Mustang Alpha',
      wikiName: 'Mustang Alpha',
      status: [],
      alwaysAvailable: [{ from: '2026-11-12' }],
      msrp: [],
    },
    {
      id: 201,
      name: 'MOLE',
      wikiName: 'MOLE',
      status: [],
      alwaysAvailable: [{ from: '2026-11-12' }],
      msrp: [],
    },
    {
      id: 228,
      name: 'Cutlass Steel',
      wikiName: 'Cutlass Steel',
      status: [],
      alwaysAvailable: [],
      msrp: [],
    },
  ],
} as unknown as ShipFacts;
const check = createAlwaysAvailableCheck(createShipFactsLookup(facts));

/** An item of the dialog's target list, as RSI renders it. */
const item = (name: string, id?: number) => `
  <div class="ColumnsLayout ShipItem small"${id === undefined ? '' : ` data-store-action-label="Select ${name} (id: ${id}) as to ship"`}>
    <h3 class="ShipItem-title"><span class="ShipItem-general-information-name">${name}</span></h3>
    <div class="ShipItem-general-information-status-and-stock"><p class="StockLeft--shipUpgrade">in stock</p></div>
  </div>`;
const dialog = (items: string, from = '') => {
  document.body.innerHTML = `<aside class="ShipUpgradeModal">
    <div class="ShipSelector from">${from}</div><div class="ShipSelector to">${items}</div></aside>`;
};
const options = (enabled = true): UpgradeDialogOptions => ({
  enabled: () => enabled,
  isAlwaysAvailable: check,
  texts: () => ({ label: 'Always available', hint: 'From the ship facts' }),
  onMismatch: vi.fn(),
});
const labelled = () =>
  [...document.querySelectorAll('.ShipSelector.to .ShipItem')]
    .filter((entry) => entry.querySelector('.shm-always-available-label'))
    .map((entry) => entry.querySelector('.ShipItem-general-information-name')!.textContent);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('targetOf and the check', () => {
  it("reads RSI's id and the name of a target ship", () => {
    dialog(item('Mustang Alpha', 65) + item('MOLE'));
    const [first, second] = document.querySelectorAll('.ShipItem');
    expect(targetOf(first!)).toEqual({ id: 65, name: 'Mustang Alpha' });
    expect(targetOf(second!)).toEqual({ name: 'MOLE' });
  });

  it('matches by id, else by name, and not an unknown ship', () => {
    expect(check({ id: 65, name: 'Something else' })).toBe(true);
    expect(check({ name: 'mole' })).toBe(true);
    expect(check({ id: 228, name: 'Cutlass Steel' })).toBe(false);
    expect(check({ name: 'Unknown Ship' })).toBe(false);
    expect(check({})).toBe(false);
  });

  it('labels nothing without the ship facts', () => {
    expect(createAlwaysAvailableCheck(undefined)({ id: 65 })).toBe(false);
  });
});

describe('applyLabels', () => {
  it('labels the always available ships on both sides, base and target ships', () => {
    dialog(
      item('Mustang Alpha', 65) + item('Cutlass Steel', 228) + item('MOLE'),
      item('Mustang Alpha', 65),
    );
    applyLabels(document, options());
    expect(labelled()).toEqual(['Mustang Alpha', 'MOLE']);
    const label = document.querySelector('.ShipSelector.to .shm-always-available-label')!;
    expect(label.textContent).toBe('Always available');
    expect(label.getAttribute('title')).toBe('From the ship facts');
    expect(
      document.querySelector('.ShipSelector.from .shm-always-available-label')?.textContent,
    ).toBe('Always available');
  });

  it('follows an item reused for another ship, and removes the labels when turned off', () => {
    dialog(item('Mustang Alpha', 65));
    applyLabels(document, options());
    const entry = document.querySelector('.ShipItem')!;
    entry.setAttribute('data-store-action-label', 'Select Cutlass Steel (id: 228) as to ship');
    entry.querySelector('.ShipItem-general-information-name')!.textContent = 'Cutlass Steel';
    applyLabels(document, options());
    expect(labelled()).toEqual([]);
    dialog(item('Mustang Alpha', 65));
    applyLabels(document, options());
    applyLabels(document, options());
    expect(document.querySelectorAll('.shm-always-available-label')).toHaveLength(1);
    applyLabels(document, options(false));
    expect(labelled()).toEqual([]);
  });
});

describe('watchUpgradeDialog', () => {
  it('reports changed markup once, and adds no label', async () => {
    document.body.innerHTML = `<aside class="ShipUpgradeModal"><div class="ShipSelector to">
      <div class="ShipItem"><span>?</span></div></div></aside>`;
    const settings = options();
    const watcher = watchUpgradeDialog(document, settings);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    watcher.update();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(settings.onMismatch).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.shm-always-available-label')).toBeNull();
    watcher.stop();
  });

  it('labels a dialog opened later, and removes its labels when stopped', async () => {
    const watcher = watchUpgradeDialog(document, options());
    dialog(item('Mustang Alpha', 65));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(labelled()).toEqual(['Mustang Alpha']);
    watcher.stop();
    expect(labelled()).toEqual([]);
  });
});

describe('the countdown on target ships (#570)', () => {
  it('goes where the label would, only on the target ships, and away with it', () => {
    dialog(item('Cutlass Steel', 228) + item('Mustang Alpha', 65), item('Cutlass Steel', 228));
    let countdownOf: UpgradeDialogOptions['countdownOf'] = (target) =>
      target.id === 228
        ? { text: 'Expected gone in 5 days', hint: 'Until the IAE ends' }
        : undefined;
    const opts = () => ({
      ...options(),
      countdownOf: (target: UpgradeTarget) => countdownOf?.(target),
    });
    applyLabels(document, opts());
    const lines = () =>
      [...document.querySelectorAll('.shm-upgrade-countdown')].map((line) => [
        line.closest('.ShipSelector')!.classList.contains('to'),
        line.textContent,
        line.getAttribute('title'),
      ]);
    expect(lines()).toEqual([[true, 'Expected gone in 5 days', 'Until the IAE ends']]);
    countdownOf = () => undefined;
    applyLabels(document, opts());
    expect(lines()).toEqual([]);
  });
});

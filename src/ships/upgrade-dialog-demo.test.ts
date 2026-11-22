// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_SHIPS_ATTRIBUTE,
  applyDemoShips,
  clearDemoShips,
  DEMO_CLASS,
} from './upgrade-dialog-demo';

/* RSI's ship upgrade dialog in the demo mode (#586). */

const HINT = 'Off in the demo mode';

/** The choice between "My ships" and "All ships" of a side, as RSI renders it. */
const ownership = (mine: boolean) => `
  <div class="RadioButtonGroup ShipSearch-radiobutton-ownership">
    <div class="RadioButton${mine ? ' checked' : ''}"><div class="input-wrapper">
      <input type="radio" name="shipOwnership-0" id="shipOwnership-0"${mine ? ' checked' : ''}></div>
      <label for="shipOwnership-0">My ships</label></div>
    <div class="RadioButton${mine ? '' : ' checked'}"><div class="input-wrapper">
      <input type="radio" name="shipOwnership-1" id="shipOwnership-1"${mine ? '' : ' checked'}></div>
      <label for="shipOwnership-1">All ships</label></div>
  </div>`;
const side = (kind: 'from' | 'to', choice: string) => `
  <div class="ShipSelector ${kind}"><div class="ShipList">
    <div class="ShipSearch">${choice}</div><div class="ShipItem">Ship</div></div></div>`;
const dialog = (from: string, to = side('to', ownership(false))) => {
  document.body.innerHTML = `<aside class="ShipUpgradeModal">${from}${to}</aside>`;
};
const sideOf = (kind: 'from' | 'to') => document.querySelector(`.ShipSelector.${kind}`)!;
const myShips = (kind: 'from' | 'to') => sideOf(kind).querySelector<HTMLElement>('.RadioButton')!;
const allShipsInput = (kind: 'from' | 'to') =>
  sideOf(kind).querySelectorAll<HTMLInputElement>('input')[1]!;

afterEach(() => {
  clearDemoShips(document);
  document.body.innerHTML = '';
});

describe('applyDemoShips', () => {
  it('switches the base ships to "All ships" once and keeps them hidden meanwhile', () => {
    dialog(side('from', ownership(true)));
    const click = vi.spyOn(allShipsInput('from'), 'click');
    expect(applyDemoShips(document, true, HINT)).toBeUndefined();
    expect(document.documentElement.classList.contains(DEMO_CLASS)).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
    expect(sideOf('from').hasAttribute(ALL_SHIPS_ATTRIBUTE)).toBe(false);
    applyDemoShips(document, true, HINT);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('marks the sides on "All ships", so their ships show', () => {
    dialog(side('from', ownership(false)));
    applyDemoShips(document, true, HINT);
    expect(sideOf('from').hasAttribute(ALL_SHIPS_ATTRIBUTE)).toBe(true);
    expect(sideOf('to').hasAttribute(ALL_SHIPS_ATTRIBUTE)).toBe(true);
  });

  it('disables "My ships" on both sides with its tooltip, and enables it outside the demo', () => {
    dialog(side('from', ownership(false)));
    applyDemoShips(document, true, HINT);
    for (const kind of ['from', 'to'] as const) {
      expect(myShips(kind).title).toBe(HINT);
      expect(myShips(kind).querySelector('input')!.disabled).toBe(true);
    }
    applyDemoShips(document, false, HINT);
    expect(document.documentElement.classList.contains(DEMO_CLASS)).toBe(false);
    for (const kind of ['from', 'to'] as const) {
      expect(myShips(kind).hasAttribute('title')).toBe(false);
      expect(myShips(kind).querySelector('input')!.disabled).toBe(false);
    }
  });

  it('unmarks a side back on "My ships"', () => {
    dialog(side('from', ownership(false)), side('to', ownership(false)));
    applyDemoShips(document, true, HINT);
    dialog(side('from', ownership(false)), side('to', ownership(true)));
    sideOf('to').setAttribute(ALL_SHIPS_ATTRIBUTE, '');
    applyDemoShips(document, true, HINT);
    expect(sideOf('to').hasAttribute(ALL_SHIPS_ATTRIBUTE)).toBe(false);
  });

  it('keeps a marked side without the choice, e.g. with a ship chosen', () => {
    dialog(side('from', ownership(false)));
    applyDemoShips(document, true, HINT);
    sideOf('from').querySelector('.ShipSearch')!.innerHTML = '';
    expect(applyDemoShips(document, true, HINT)).toBeUndefined();
    expect(sideOf('from').hasAttribute(ALL_SHIPS_ATTRIBUTE)).toBe(true);
  });

  it('reports changed markup and leaves the ships hidden', () => {
    dialog(side('from', ''));
    expect(applyDemoShips(document, true, HINT)).toBe('no choice between my ships and all ships');
    expect(sideOf('from').hasAttribute(ALL_SHIPS_ATTRIBUTE)).toBe(false);
    expect(applyDemoShips(document, false, HINT)).toBeUndefined();
  });

  it('removes every trace when cleared', () => {
    dialog(side('from', ownership(false)));
    applyDemoShips(document, true, HINT);
    clearDemoShips(document);
    expect(document.documentElement.classList.contains(DEMO_CLASS)).toBe(false);
    expect(document.querySelector(`[${ALL_SHIPS_ATTRIBUTE}]`)).toBeNull();
    expect(myShips('from').querySelector('input')!.disabled).toBe(false);
  });
});

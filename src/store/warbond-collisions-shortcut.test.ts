// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import type { Pledge } from '@/hangar/pledge';
import { toPledgeView, type PledgeView } from '@/hangar/pledge-view';
import { filterRequestOf, listShortcuts, openListShortcut } from '@/hangar/list-shortcut';
import type { Ship } from '@/ships/ships';
import { buildWarbondOffers, type WarbondTarget } from './warbond';
import { warbondCollisionsShortcut } from './warbond-collisions-shortcut';

const ship = (id: number, name: string, msrp: number): Ship => ({ id, name, msrp });
const SHIPS = [
  ship(1, 'Freelancer', 110),
  ship(2, 'Vulture', 175),
  ship(3, 'Apollo Triage', 260),
  ship(4, 'Mercury', 260),
  ship(5, 'Eclipse', 300),
  ship(6, 'Redeemer', 330),
];
const eclipse: WarbondTarget = { ship: SHIPS[4]!, skuId: 19395, price: 270 };

const ccu = (id: number, from: string, to: string, valueUsd: number) =>
  toPledgeView({
    id,
    name: `Upgrade - ${from} to ${to}`,
    title: `Upgrade - ${from} to ${to}`,
    value: `${valueUsd} USD`,
    valueUsd,
    items: [],
    isUpgraded: false,
    upgrade: { matchItems: [{ id: 1, name: from }], targetItems: [{ id: 2, name: to }], type: 'R' },
  } as unknown as Pledge);

const HANGAR = [
  // Chainable: they end at or below the warbond price of $270, or start at the msrp of $300.
  ccu(10, 'Freelancer', 'Apollo Triage', 150),
  ccu(11, 'Eclipse', 'Redeemer', 30),
  // Colliding: to the warbond ship itself, twice with the same value, and to another ship.
  ccu(20, 'Mercury', 'Eclipse', 40),
  ccu(21, 'Mercury', 'Eclipse', 40),
  ccu(22, 'Apollo Triage', 'Redeemer', 60),
];

const [offer] = buildWarbondOffers({ ships: SHIPS, warbonds: [eclipse] }, HANGAR, []);

afterEach(() => {
  listShortcuts.value = { hangar: null, buyback: null };
  location.hash = '';
  setLocale('en');
});

describe('warbondCollisionsShortcut (#429)', () => {
  it('opens My Hangar with exactly the CCUs colliding with the warbond CCU', () => {
    expect(offer!.owned.flatMap((entry) => entry.ids).sort()).toEqual([20, 21, 22]);
    openListShortcut(warbondCollisionsShortcut(offer!));
    expect(location.hash).toBe('#hangar-manager');
    const request = filterRequestOf(listShortcuts.value.hangar)!;
    const shown = HANGAR.filter((pledge: PledgeView) => request.matches(pledge));
    expect(shown.map((pledge) => pledge.id)).toEqual([20, 21, 22]);
  });

  it('names the warbond ship in its title and empty text, in today’s language', () => {
    openListShortcut(warbondCollisionsShortcut(offer!));
    expect(listShortcuts.value.hangar!.id).toBe('warbondCollisions:5');
    let request = filterRequestOf(listShortcuts.value.hangar)!;
    expect(request).toMatchObject({
      title: 'CCUs incompatible with the warbond Eclipse',
      icon: 'shuttle-space',
      emptyText: 'None of your CCUs overlaps the price range of the warbond Eclipse any more.',
    });
    setLocale('de');
    request = filterRequestOf(listShortcuts.value.hangar)!;
    expect(request.title).toBe('Mit dem Warbond Eclipse inkompatible CCUs');
  });
});

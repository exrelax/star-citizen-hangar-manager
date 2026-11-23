import { describe, expect, it } from 'vitest';
import { hangarCcuContents } from '@/hangar/ccu-contents';
import { pledgeShipKind } from '@/hangar/ship-kind';
import { FALLBACK_CATALOG } from './catalog';
import { generatedDemo } from './demo';

/*
 * The demo cases of the refinements of the filters "Ships" (#514) and "CCUs" (#566), collected in
 * #337: each choice in My Hangar and the Buy Back. The paints by owned ships (#336) are in
 * `demo-paint-cases.test.ts`, the CCUs by base ship coverage (#461) in `demo-ccu-cases.test.ts`.
 */

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');

describe.each(['any demo key', 'another key', 'k3'])('the filter cases of the demo %s', (key) => {
  const { pledges, buyback } = generatedDemo(FALLBACK_CATALOG, key, TODAY, NOW);
  const kindOf = (pledge: (typeof pledges)[number]) => pledgeShipKind(pledge.items);

  it('has solo ships, ships with extras and ship packs in My Hangar (#514)', () => {
    const solo = pledges.filter((pledge) => kindOf(pledge) === 'solo');
    expect(solo.some((pledge) => pledge.items.some((item) => item.kind === 'Insurance'))).toBe(
      true,
    );
    const extras = pledges.filter((pledge) => kindOf(pledge) === 'extras');
    // Gear or a paint, and a starter package with game access.
    expect(
      extras.some((pledge) =>
        pledge.items.some((item) => item.kind === 'FPS Equipment' || item.kind === 'Skin'),
      ),
    ).toBe(true);
    expect(
      extras.some((pledge) => pledge.items.some((item) => item.kind === 'Digital Download')),
    ).toBe(true);
    const packs = pledges.filter((pledge) => kindOf(pledge) === 'pack');
    expect(packs.some((pledge) => pledge.pack?.length === 2)).toBe(true);
    expect(packs.some((pledge) => pledge.isUpgraded)).toBe(true);
  });

  it('has solo ships, ships with extras and ship packs in the Buy Back (#514)', () => {
    const kinds = new Set(buyback.map((pledge) => pledge.shipKind));
    for (const kind of ['solo', 'extras', 'pack'])
      expect(kinds.has(kind as never), kind).toBe(true);
  });

  it('has solo CCUs, also with an insurance, and CCUs with extras in My Hangar (#566)', () => {
    const ccus = pledges.filter((pledge) => pledge.isCcu);
    const solo = ccus.filter((pledge) => hangarCcuContents(pledge.upgrade) === 'solo');
    expect(solo.some((pledge) => pledge.upgrade!.targetItems.length === 1)).toBe(true);
    expect(solo.some((pledge) => pledge.upgrade!.targetItems.length > 1)).toBe(true);
    const extras = ccus.filter((pledge) => hangarCcuContents(pledge.upgrade) === 'extras');
    const names = extras.flatMap((pledge) => pledge.upgrade!.targetItems.slice(1));
    expect(names.some((item) => /livery|paint/i.test(item.name))).toBe(true);
    expect(names.some((item) => !/livery|paint/i.test(item.name))).toBe(true);
  });

  it('has solo CCUs and CCUs with extras in the Buy Back (#566)', () => {
    const contents = new Set(buyback.filter((pledge) => pledge.isCcu).map((p) => p.ccuContents));
    expect(contents.has('solo')).toBe(true);
    expect(contents.has('extras')).toBe(true);
  });
});

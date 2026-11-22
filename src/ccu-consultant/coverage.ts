import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { shipKey } from '@/hangar/ship-images';
import { ccuShips } from '@/hangar/upgrade-log';
import type { Ship } from '@/ships/ships';
import { createShipLookup } from '@/store/warbond';
import { computed, inject, shallowRef, type ComputedRef, type InjectionKey, type Ref } from 'vue';

/*
 * The base ship coverage of every CCU of the hangar (#108), the core of the CCU Consultant (#106).
 * A CCU can only be applied to its base ship (the "from" ship), so it is **covered** if the user's
 * own items give that ship:
 * - a hangar pledge with the ship – standalone, in a package, or as the current ship of a pledge
 *   with applied upgrades (RSI lists its current ships);
 * - a hangar CCU with the ship as target;
 * - the same in the buy back: a pledge with the ship, or a CCU to it that RSI can sell again
 *   (#207: one it can't, can't be bought back).
 * A CCU never covers itself.
 *
 * Ships are matched as everywhere in the manager: by the upgrade tool's id – a buy back CCU names
 * it on its button, otherwise the name is looked up in the upgrade tool's ships, which knows RSI's
 * other names. A name the upgrade tool doesn't know is compared by its words.
 */

export type CoverageSource = 'hangar' | 'buyback';
export type CoverageKind = 'ship' | 'ccu';

/** A pledge that gives the base ship. */
export interface CoverageMatch {
  source: CoverageSource;
  kind: CoverageKind;
  /** The pledge's id in My Hangar or the buy back. */
  id: number;
  /** Shown instead of the id, if set (made-up ids of the demo). */
  displayId?: string;
  title: string;
  /** Its page in RSI's list, and in the buy back its position, for a link to it. */
  page?: number;
  position?: number;
}

export interface CcuCoverage {
  /** The CCU's pledge id in My Hangar. */
  id: number;
  /** The base ship: the upgrade tool's ship, if known, else its name from the CCU. */
  baseShip?: { id?: number; name: string };
  /** What gives the base ship, by where and what it is. */
  hangar: { ships: CoverageMatch[]; ccus: CoverageMatch[] };
  buyback: { ships: CoverageMatch[]; ccus: CoverageMatch[] };
  covered: boolean;
}

export interface CoverageInput {
  /** The upgrade tool's ships, for their ids and RSI's other names; may be empty. */
  ships: readonly Ship[];
  hangar: readonly (Pick<PledgeView, 'id' | 'title' | 'isCcu' | 'upgrade' | 'items'> &
    Partial<Pick<PledgeView, 'displayId' | 'page'>>)[];
  buyback: readonly (Pick<
    BuybackView,
    'id' | 'title' | 'isCcu' | 'upgrade' | 'unavailable' | 'ships'
  > &
    Partial<Pick<BuybackView, 'displayId' | 'page' | 'position'>>)[];
}

/** Every match of a ship, by the ship's key. */
type Matches = Map<string, CoverageMatch[]>;

/**
 * The coverage of each CCU of the hangar, by its pledge id; with `of: 'buyback'` of each CCU of the
 * buy back instead (#574, for its groups), by the same matches.
 */
export function ccuCoverage(
  input: CoverageInput,
  of: CoverageSource = 'hangar',
): Map<number, CcuCoverage> {
  const lookup = createShipLookup(input.ships);
  /** A ship's key: the upgrade tool's id where known, else the words of its name. */
  const keyOf = (name: string | undefined, id?: number): string | undefined => {
    const shipId = id ?? (name ? lookup.shipOf(name)?.id : undefined);
    if (shipId !== undefined) return `id:${shipId}`;
    return name ? `name:${shipKey(name)}` : undefined;
  };

  const matches: Matches = new Map();
  const add = (key: string | undefined, match: CoverageMatch) => {
    if (!key) return;
    const list = matches.get(key) ?? [];
    list.push(match);
    matches.set(key, list);
  };

  /** A match with what a link to the pledge needs. */
  const matchOf = (
    source: CoverageSource,
    kind: CoverageKind,
    pledge: CoverageInput['hangar'][number] | CoverageInput['buyback'][number],
  ): CoverageMatch => ({
    source,
    kind,
    id: pledge.id,
    title: pledge.title,
    ...(pledge.displayId !== undefined && { displayId: pledge.displayId }),
    ...(pledge.page !== undefined && { page: pledge.page }),
    ...('position' in pledge && pledge.position !== undefined && { position: pledge.position }),
  });

  const bases: { id: number; key?: string; name?: string; shipId?: number }[] = [];
  const base = (id: number, from: string | undefined, fromShipId?: number) => {
    const shipId = fromShipId ?? (from ? lookup.shipOf(from)?.id : undefined);
    bases.push({
      id,
      key: keyOf(from, fromShipId),
      ...(from && { name: from }),
      ...(shipId !== undefined && { shipId }),
    });
  };
  for (const pledge of input.hangar) {
    if (pledge.isCcu && of === 'hangar') {
      const names = ccuShips(pledge.title);
      const from = pledge.upgrade?.matchItems[0]?.name ?? names?.from;
      const to = pledge.upgrade?.targetItems[0]?.name ?? names?.to;
      base(pledge.id, from);
      add(keyOf(to), matchOf('hangar', 'ccu', pledge));
      continue;
    }
    if (pledge.isCcu) {
      const names = ccuShips(pledge.title);
      const to = pledge.upgrade?.targetItems[0]?.name ?? names?.to;
      add(keyOf(to), matchOf('hangar', 'ccu', pledge));
      continue;
    }
    // Each ship once per pledge, e.g. a package with two of the same.
    const keys = new Set(
      pledge.items.filter((item) => item.kind === 'Ship').map((item) => keyOf(item.title)),
    );
    for (const key of keys) {
      add(key, matchOf('hangar', 'ship', pledge));
    }
  }
  for (const pledge of input.buyback) {
    if (pledge.isCcu) {
      if (of === 'buyback')
        base(pledge.id, ccuShips(pledge.title)?.from, pledge.upgrade?.fromShipId);
      if (pledge.unavailable) continue;
      const to = ccuShips(pledge.title)?.to;
      add(keyOf(to, pledge.upgrade?.toShipId), matchOf('buyback', 'ccu', pledge));
      continue;
    }
    const keys = new Set(pledge.ships.map((ship) => keyOf(ship.name)));
    for (const key of keys) {
      add(key, matchOf('buyback', 'ship', pledge));
    }
  }

  const result = new Map<number, CcuCoverage>();
  for (const base of bases) {
    const found = (base.key ? (matches.get(base.key) ?? []) : []).filter(
      // A CCU never covers itself.
      (match) => !(match.source === of && match.id === base.id),
    );
    const pick = (source: CoverageSource, kind: CoverageKind) =>
      found.filter((match) => match.source === source && match.kind === kind);
    result.set(base.id, {
      id: base.id,
      ...(base.name && {
        baseShip: { ...(base.shipId !== undefined && { id: base.shipId }), name: base.name },
      }),
      hangar: { ships: pick('hangar', 'ship'), ccus: pick('hangar', 'ccu') },
      buyback: { ships: pick('buyback', 'ship'), ccus: pick('buyback', 'ccu') },
      covered: found.length > 0,
    });
  }
  return result;
}

/** The coverage of every CCU, worked out again whenever the hangar, buy back or ships change. */
export const useCcuCoverage = (
  input: () => CoverageInput,
  of: CoverageSource = 'hangar',
): ComputedRef<Map<number, CcuCoverage>> => computed(() => ccuCoverage(input(), of));

export const CCU_COVERAGE: InjectionKey<Readonly<Ref<Map<number, CcuCoverage>>>> =
  Symbol('shm-ccu-coverage');

/** The coverage provided by the manager view (see `App.vue`); none outside of it. */
export function useProvidedCcuCoverage(): Readonly<Ref<Map<number, CcuCoverage>>> {
  return inject(CCU_COVERAGE, shallowRef(new Map()));
}

/** The coverage of the buy back's CCUs (#574), for its groups; apart from the hangar's. */
export const BUYBACK_CCU_COVERAGE: InjectionKey<Readonly<Ref<Map<number, CcuCoverage>>>> = Symbol(
  'shm-buyback-ccu-coverage',
);

export function useProvidedBuybackCcuCoverage(): Readonly<Ref<Map<number, CcuCoverage>>> {
  return inject(BUYBACK_CCU_COVERAGE, shallowRef(new Map()));
}

/** The shown pledges and the upgrade tool's ships, for the details of an entry (#426). */
export interface CoverageSources {
  hangar: ReadonlyMap<number, PledgeView>;
  buyback: ReadonlyMap<number, BuybackView>;
  ships: readonly Ship[];
}

export const COVERAGE_SOURCES: InjectionKey<Readonly<Ref<CoverageSources>>> =
  Symbol('shm-coverage-sources');

/** The sources provided by the manager view (see `App.vue`); empty outside of it. */
export function useProvidedCoverageSources(): Readonly<Ref<CoverageSources>> {
  return inject(COVERAGE_SOURCES, shallowRef({ hangar: new Map(), buyback: new Map(), ships: [] }));
}

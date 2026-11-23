import type { AlwaysAvailableList } from './always-available';
import { baseKeyOf } from './base-ship-list';
import type { CcuCoverage, CoverageMatch } from './coverage';

/*
 * The deep view of the CCU Consultant (#563): the ways to each base ship with the chains followed.
 * The simple view counts every ship and CCU to a base ship as a way to it; here a CCU to it only
 * counts if its own base ship has a way too – recursively –, and every way serves one CCU:
 *
 * - each ship of the hangar gives its ship once ("ship in your hangar");
 * - each ship of the buy back and each CCU to the ship in the buy back RSI can sell again gives it
 *   once ("in your buy back"); a buy back CCU isn't followed further, as the simple view counts it;
 * - an always available ship (if considered) gives itself as often as needed;
 * - a hangar CCU from A to B gives B once – if it got one of A's ways itself. Its way to B is a
 *   "chain in your hangar", or counts as buy back if the chain starts in the buy back.
 *
 * The ways of a ship go to the CCUs from it, the best ones first (the hangar's, then always
 * available ships, then the buy back's), and first to the CCUs whose target still lacks ways, so
 * the chains reach as far as they can. Ships are handled from the start of the chains on (cheaper
 * ships first, as CCUs lead to pricier ones); a ship in a cycle of CCUs, which RSI doesn't sell,
 * gets what reached it so far.
 */

/** How a way reaches a base ship: as the colors of the deep view's bar. */
export type WayKind = 'ship' | 'chain' | 'buyback';
/** Where a chain starts: a ship in the hangar, an always available ship or the buy back. */
export type RootKind = 'ship' | 'always' | 'buyback';

/** CCUs of the hangar that lead to a base ship along the same ships. */
export interface ChainRoute {
  /** The ships the chains pass, by key: the start ship first, the one before the base ship last. */
  path: string[];
  root: RootKind;
  /** How many ways they give the base ship. */
  count: number;
}

/** Hangar CCUs to a base ship that don't count: their own base ship has no way left for them. */
export interface BlockedRoute {
  /** Their base ship, by key. */
  from: string;
  count: number;
}

export interface ChainShip {
  /** As `BaseShipRow.key`. */
  key: string;
  /** None if the CCUs' titles don't tell it. */
  name?: string;
  shipId?: number;
  /** The CCUs from it (their pledge ids in My Hangar). */
  ccus: number[];
  /** Always available (and considered): never short of ways. */
  always: boolean;
  /** Its ways by kind. */
  ways: Record<WayKind, number>;
  /** All its ways. */
  total: number;
  /** How many CCUs from it have no way to it; 0 if always available. */
  short: number;
  /** The ways the simple view counts: every ship and CCU to it in the hangar and the buy back. */
  simpleWays: number;
  /** Short of ways only by the chain rule: the simple view counts it covered. */
  deepOnly: boolean;
  /** The chains of hangar CCUs leading to it, the most ways first. */
  routes: ChainRoute[];
  /** The hangar CCUs to it that don't count, by their base ship. */
  blocked: BlockedRoute[];
  /** The buy back's ships and CCUs to it. */
  buyback: CoverageMatch[];
  /** The hangar's ships with it. */
  hangarShips: CoverageMatch[];
}

export interface ChainCoverage {
  /** Every base ship of the hangar's CCUs, by key. */
  ships: Map<string, ChainShip>;
  /** Those short of ways: the most short first. */
  tooFew: ChainShip[];
  /** How many CCUs of `tooFew` have no way to their base ship. */
  tooFewCount: number;
}

interface Unit {
  root: RootKind;
  /** The ships passed before the current one, the start first. */
  path: string[];
  /** Given by the ship itself (not passed along a CCU). */
  own: boolean;
}

interface Node {
  key: string;
  name?: string;
  shipId?: number;
  ccus: number[];
  always: boolean;
  hangarShips: Map<number, CoverageMatch>;
  buyback: Map<number, CoverageMatch>;
  /** Hangar CCUs to it, by id. */
  incoming: Set<number>;
  simpleWays: number;
  /** The ways that reached it along CCUs. */
  arrived: Unit[];
  /** The CCUs to it whose way reached it. */
  delivered: Set<number>;
}

/** The order the ways of a ship are handed on: the hangar's first, the buy back's last. */
const rank = (unit: { root: RootKind }) =>
  unit.root === 'ship' ? 0 : unit.root === 'always' ? 1 : 2;

/** The deep view's ways to every base ship of the hangar's CCUs. */
export function chainCoverage(
  coverages: Iterable<CcuCoverage>,
  always: AlwaysAvailableList | undefined,
): ChainCoverage {
  const list = [...coverages];
  const nodes = new Map<string, Node>();
  /** The base ship of each CCU, by key. */
  const baseOf = new Map<number, string>();
  /** The base ship each hangar CCU leads to, by key. */
  const targetOf = new Map<number, string>();
  for (const coverage of list) {
    const key = baseKeyOf(coverage);
    baseOf.set(coverage.id, key);
    let node = nodes.get(key);
    if (!node) {
      const base = coverage.baseShip;
      node = {
        key,
        ...(base && { name: base.name }),
        ...(base?.id !== undefined && { shipId: base.id }),
        ccus: [],
        always: base?.id !== undefined && always?.has(base.id) === true,
        hangarShips: new Map(),
        buyback: new Map(),
        incoming: new Set(),
        simpleWays: 0,
        arrived: [],
        delivered: new Set(),
      };
      nodes.set(key, node);
    }
    node.ccus.push(coverage.id);
    for (const match of coverage.hangar.ships) node.hangarShips.set(match.id, match);
    for (const match of [...coverage.buyback.ships, ...coverage.buyback.ccus]) {
      node.buyback.set(match.id, match);
    }
    for (const match of coverage.hangar.ccus) {
      node.incoming.add(match.id);
      targetOf.set(match.id, key);
    }
  }
  for (const node of nodes.values()) {
    node.simpleWays = node.hangarShips.size + node.incoming.size + node.buyback.size;
  }

  // The CCUs between base ships: from the ship it starts from to the one it leads to.
  const edges = new Map<string, { id: number; to: string }[]>();
  const indegree = new Map<string, number>([...nodes.keys()].map((key) => [key, 0]));
  for (const [id, to] of targetOf) {
    const from = baseOf.get(id);
    if (from === undefined || from === to) continue;
    const out = edges.get(from) ?? [];
    out.push({ id, to });
    edges.set(from, out);
    indegree.set(to, (indegree.get(to) ?? 0) + 1);
  }

  const done = new Set<string>();
  /** How many more ways a ship needs for every CCU from it. */
  const need = (key: string) => {
    const node = nodes.get(key);
    if (!node || node.always || done.has(key)) return 0;
    return node.ccus.length - node.hangarShips.size - node.buyback.size - node.arrived.length;
  };
  const handle = (node: Node) => {
    done.add(node.key);
    const units: Unit[] = [
      ...[...node.hangarShips.keys()].map((): Unit => ({ root: 'ship', path: [], own: true })),
      ...node.arrived,
      ...[...node.buyback.keys()].map((): Unit => ({ root: 'buyback', path: [], own: true })),
    ].sort((a, b) => rank(a) - rank(b));
    const out = [...(edges.get(node.key) ?? [])].sort((a, b) => a.id - b.id);
    // An always available ship gives itself to each CCU from it the hangar's ways don't serve.
    const always = node.always
      ? Math.max(0, out.length - units.filter((u) => u.root !== 'buyback').length)
      : 0;
    const offered: Unit[] = [
      ...units.filter((unit) => unit.root !== 'buyback'),
      ...Array.from({ length: always }, (): Unit => ({ root: 'always', path: [], own: true })),
      ...units.filter((unit) => unit.root === 'buyback'),
    ];
    // The CCUs from it beyond its ways get none; the others go first to targets lacking ways.
    for (const unit of offered.slice(0, out.length)) {
      let best = 0;
      for (let index = 1; index < out.length; index++) {
        if (need(out[index]!.to) > need(out[best]!.to)) best = index;
      }
      const [edge] = out.splice(best, 1);
      const target = nodes.get(edge!.to);
      if (!target || done.has(target.key)) continue;
      target.arrived.push({ root: unit.root, path: [...unit.path, node.key], own: false });
      target.delivered.add(edge!.id);
    }
    for (const edge of edges.get(node.key) ?? []) {
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) - 1);
    }
  };

  // From the start of the chains on; a cycle is entered at its ship with the fewest CCUs to it.
  const byKey = (a: Node, b: Node) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  while (done.size < nodes.size) {
    const open = [...nodes.values()].filter((node) => !done.has(node.key));
    const ready = open.filter((node) => (indegree.get(node.key) ?? 0) <= 0).sort(byKey);
    if (ready.length) {
      for (const node of ready) handle(node);
      continue;
    }
    const next = open.sort(
      (a, b) => (indegree.get(a.key) ?? 0) - (indegree.get(b.key) ?? 0) || byKey(a, b),
    )[0]!;
    handle(next);
  }

  const ships = new Map<string, ChainShip>();
  for (const node of nodes.values()) {
    const viaBuyback = node.arrived.filter((unit) => unit.root === 'buyback').length;
    const ways: Record<WayKind, number> = {
      ship: node.hangarShips.size,
      chain: node.arrived.length - viaBuyback,
      buyback: node.buyback.size + viaBuyback,
    };
    const total = ways.ship + ways.chain + ways.buyback;
    const short = node.always ? 0 : Math.max(0, node.ccus.length - total);
    const routes = new Map<string, ChainRoute>();
    for (const unit of node.arrived) {
      const id = `${unit.root}:${unit.path.join('>')}`;
      const route = routes.get(id) ?? { path: unit.path, root: unit.root, count: 0 };
      route.count++;
      routes.set(id, route);
    }
    const blocked = new Map<string, number>();
    for (const id of node.incoming) {
      if (node.delivered.has(id)) continue;
      const from = baseOf.get(id);
      if (from !== undefined) blocked.set(from, (blocked.get(from) ?? 0) + 1);
    }
    ships.set(node.key, {
      key: node.key,
      ...(node.name !== undefined && { name: node.name }),
      ...(node.shipId !== undefined && { shipId: node.shipId }),
      ccus: node.ccus,
      always: node.always,
      ways,
      total,
      short,
      simpleWays: node.simpleWays,
      deepOnly: short > 0 && node.simpleWays >= node.ccus.length,
      routes: [...routes.values()].sort((a, b) => b.count - a.count || rank(a) - rank(b)),
      blocked: [...blocked]
        .map(([from, count]) => ({ from, count }))
        .sort((a, b) => b.count - a.count || (a.from < b.from ? -1 : 1)),
      buyback: [...node.buyback.values()],
      hangarShips: [...node.hangarShips.values()],
    });
  }
  const tooFew = [...ships.values()]
    .filter((ship) => ship.short > 0)
    .sort(
      (a, b) =>
        b.short - a.short ||
        b.ccus.length - a.ccus.length ||
        Number(a.name === undefined) - Number(b.name === undefined) ||
        (a.name ?? '').localeCompare(b.name ?? '', 'en'),
    );
  return { ships, tooFew, tooFewCount: tooFew.reduce((sum, ship) => sum + ship.short, 0) };
}

import type { AlwaysAvailableList } from './always-available';
import { baseKeyOf } from './base-ship-list';
import type { CcuCoverage, CoverageMatch } from './coverage';

/*
 * The deep view of the CCU Consultant (#563, #651): can every CCU of the hangar with a discount be
 * applied? Each one needs a pledge with its base ship, and the pledges come along chains:
 *
 * - each ship of the hangar gives its ship once ("ship in your hangar");
 * - each ship of the buy back gives it once ("in your buy back");
 * - an always available ship (if considered) gives itself as often as needed – also as the target
 *   of a CCU that can be bought any time, so it closes any gap to it;
 * - a CCU from A to B – in the hangar, or in the buy back if RSI can sell it again – takes a pledge
 *   of A on to B. A CCU in the buy back makes its way one of the buy back; without the buy back's
 *   coverages it gives B once, as the simple view counts it.
 *
 * Only the hangar's CCUs with a discount need a way (`CcuCoverage.discount`; unknown counts as
 * one): those without, and the buy back's, are optional links of the chains and never short. The
 * ways are handed out so that as many CCUs with a discount as possible get one – a min-cost flow
 * from the ships to the CCUs, which prefers the hangar's ships, then always available ships, then
 * the buy back. A ship only CCUs in the buy back start from is a link without a row. A CCU that
 * closes a cycle of CCUs, which RSI doesn't sell, takes no pledge on.
 */

/** How a way reaches a base ship: as the colors of the deep view's bar. */
export type WayKind = 'ship' | 'chain' | 'buyback';
/** Where a chain starts: a ship in the hangar, an always available ship or the buy back. */
export type RootKind = 'ship' | 'always' | 'buyback';

/** Chains that lead to a base ship along the same ships. */
export interface ChainRoute {
  /** The ships the chains pass, by key: the start ship first, the one before the base ship last. */
  path: string[];
  root: RootKind;
  /** It passes a CCU in the buy back (#651): its way is one of the buy back. */
  buyback?: boolean;
  /** How many ways they give the base ship. */
  count: number;
}

/** Hangar CCUs to a base ship short of ways that carry no way to it, by their base ship. */
export interface BlockedRoute {
  /** Their base ship, by key. */
  from: string;
  count: number;
}

/** CCUs in the buy back to a base ship short of ways that carry no way to it (#651). */
export interface BlockedBuyback extends BlockedRoute {
  /** All CCUs from that ship to the base ship in the buy back. */
  total: number;
}

/** Where the ways to a ship go (#651): its CCUs in the hangar, those in the buy back by target. */
export interface ChainUse {
  ways: number;
  hangar: number;
  buyback: { to: string; count: number }[];
  /** The hangar's CCUs to it that carry no way, by their base ship: theirs are taken. */
  idle: { from: string; count: number }[];
}

/** A ship of the chains: a base ship of the hangar's CCUs, or a link of the buy back's CCUs. */
export interface ChainNode {
  key: string;
  name?: string;
  shipId?: number;
  always: boolean;
  /** Where its ways went; none if always available. */
  use?: ChainUse;
}

export interface ChainShip {
  /** As `BaseShipRow.key`. */
  key: string;
  /** None if the CCUs' titles don't tell it. */
  name?: string;
  shipId?: number;
  /** The CCUs from it with a discount, which need a way (their pledge ids in My Hangar). */
  ccus: number[];
  /** The CCUs from it without a discount: optional links, never short. */
  others: number[];
  /** Always available (and considered): never short of ways. */
  always: boolean;
  /** The ways of its CCUs with a discount, by kind. */
  ways: Record<WayKind, number>;
  /** All of them. */
  total: number;
  /** How many CCUs with a discount from it have no way; 0 if always available. */
  short: number;
  /** The ways the simple view counts: every ship and CCU to it in the hangar and the buy back. */
  simpleWays: number;
  /** Short of ways only by the chain rule: the simple view counts it covered. */
  deepOnly: boolean;
  /** The chains that give its CCUs with a discount their ways, the most ways first. */
  routes: ChainRoute[];
  /** While short: the hangar CCUs to it without a way, by their base ship. */
  blocked: BlockedRoute[];
  /** While short: the buy back's CCUs to it without a way, by their base ship (#651). */
  blockedBuyback: BlockedBuyback[];
  /** The buy back's ships and CCUs to it. */
  buyback: CoverageMatch[];
  /** The hangar's ships with it. */
  hangarShips: CoverageMatch[];
}

export interface ChainCoverage {
  /** Every base ship of the hangar's CCUs, by key. */
  ships: Map<string, ChainShip>;
  /** Every ship of the chains, also the links of the buy back's CCUs, by key. */
  nodes: Map<string, ChainNode>;
  /** Those short of ways: the most short first. */
  tooFew: ChainShip[];
  /** How many CCUs with a discount of `tooFew` have no way to their base ship. */
  tooFewCount: number;
}

interface Node {
  key: string;
  name?: string;
  shipId?: number;
  /** The hangar CCUs from it, with and without a discount. */
  needed: number[];
  others: number[];
  always: boolean;
  hangarShips: Map<number, CoverageMatch>;
  /** The buy back's ships and CCUs to it, as the simple view counts them. */
  buyback: Map<number, CoverageMatch>;
  /** Those that give it a way of their own: its ships, and CCUs not followed. */
  buybackOwn: Set<number>;
  /** Hangar CCUs to it, by id. */
  incoming: Set<number>;
  simpleWays: number;
}

/** A group of the same CCUs between two ships, an arc of the flow. */
interface Arc {
  kind: 'source' | 'hangar' | 'buyback' | 'sink';
  /** The root of a source arc. */
  root?: RootKind;
  from: number;
  to: number;
  capacity: number;
  cost: number;
  flow: number;
  /** Its reverse arc, by index. */
  reverse: number;
  /** A hangar CCU with a discount. */
  needed?: boolean;
  /** The ships of a CCU, by key; the target none if it leads to no ship of the chains. */
  fromKey?: string;
  toKey?: string;
  /** Not a reverse arc. */
  forward: boolean;
}

/** Costs of the flow: a CCU with a discount outweighs any chain to it. */
const NEEDED = -10_000;
const COST = { ship: 0, always: 2, buyback: 3, buybackCcu: 1 } as const;
/** As often as needed, for always available ships and the sink. */
const UNLIMITED = 1_000_000;

const rank = (root: RootKind) => (root === 'ship' ? 0 : root === 'always' ? 1 : 2);

/**
 * The deep view's ways to every base ship of the hangar's CCUs. With the buy back's coverages
 * (`ccuCoverage(…, 'buyback')`), its CCUs count only if their own base ship has a way (#651).
 */
export function chainCoverage(
  coverages: Iterable<CcuCoverage>,
  always: AlwaysAvailableList | undefined,
  buybackCoverages?: ReadonlyMap<number, CcuCoverage>,
): ChainCoverage {
  const list = [...coverages];
  const nodes = new Map<string, Node>();
  /** The base ship of each hangar CCU, by key. */
  const baseOf = new Map<number, string>();
  /** The base ship each hangar CCU leads to, if one of the chains, by key. */
  const targetOf = new Map<number, string>();
  /** The base ship each followed CCU of the buy back leads to, by key. */
  const buybackTargetOf = new Map<number, string>();
  const pending: { id: number; to: string }[] = [];

  const nodeOf = (key: string, coverage: CcuCoverage): { node: Node; created: boolean } => {
    const existing = nodes.get(key);
    if (existing) return { node: existing, created: false };
    const base = coverage.baseShip;
    const node: Node = {
      key,
      ...(base && { name: base.name }),
      ...(base?.id !== undefined && { shipId: base.id }),
      needed: [],
      others: [],
      always: base?.id !== undefined && always?.has(base.id) === true,
      hangarShips: new Map(),
      buyback: new Map(),
      buybackOwn: new Set(),
      incoming: new Set(),
      simpleWays: 0,
    };
    nodes.set(key, node);
    return { node, created: true };
  };
  /** What gives a ship: its ships, the hangar's CCUs to it, the buy back's. */
  const fill = (node: Node, coverage: CcuCoverage) => {
    for (const match of coverage.hangar.ships) node.hangarShips.set(match.id, match);
    for (const match of coverage.buyback.ships) {
      node.buyback.set(match.id, match);
      node.buybackOwn.add(match.id);
    }
    for (const match of coverage.buyback.ccus) {
      node.buyback.set(match.id, match);
      if (buybackCoverages?.has(match.id)) pending.push({ id: match.id, to: node.key });
      else node.buybackOwn.add(match.id);
    }
    for (const match of coverage.hangar.ccus) {
      node.incoming.add(match.id);
      targetOf.set(match.id, node.key);
    }
  };

  for (const coverage of list) {
    const key = baseKeyOf(coverage);
    baseOf.set(coverage.id, key);
    const { node } = nodeOf(key, coverage);
    (coverage.discount === false ? node.others : node.needed).push(coverage.id);
    fill(node, coverage);
  }
  // The buy back's CCUs followed to their base ships, a link of the chains where none is yet.
  while (pending.length) {
    const { id, to } = pending.shift()!;
    if (buybackTargetOf.has(id)) continue;
    const coverage = buybackCoverages!.get(id)!;
    buybackTargetOf.set(id, to);
    const { node, created } = nodeOf(baseKeyOf(coverage), coverage);
    if (created) fill(node, coverage);
  }
  for (const node of nodes.values()) {
    node.simpleWays = node.hangarShips.size + node.incoming.size + node.buyback.size;
  }

  // The CCUs between ships, grouped by their ships; cycles cut where they close.
  const keys = [...nodes.keys()].sort();
  const index = new Map(keys.map((key, i) => [key, i]));
  type Link = { from: string; to?: string; buyback: boolean; needed: boolean; ids: number[] };
  const links = new Map<string, Link>();
  const link = (
    from: string,
    to: string | undefined,
    buyback: boolean,
    needed: boolean,
    id: number,
  ) => {
    if (to === from) return;
    const id_ = `${from}>${to ?? ''}:${buyback ? 'b' : 'h'}${needed ? 'n' : ''}`;
    const entry = links.get(id_) ?? {
      from,
      ...(to !== undefined && { to }),
      buyback,
      needed,
      ids: [],
    };
    entry.ids.push(id);
    links.set(id_, entry);
  };
  for (const node of nodes.values()) {
    for (const id of node.needed) link(node.key, targetOf.get(id), false, true, id);
    for (const id of node.others) link(node.key, targetOf.get(id), false, false, id);
  }
  for (const [id, to] of buybackTargetOf) {
    link(baseKeyOf(buybackCoverages!.get(id)!), to, true, false, id);
  }
  const cut = cycleLinks([...links.values()], keys);

  // The flow network: a source, a node per ship, a sink.
  const SOURCE = keys.length;
  const SINK = keys.length + 1;
  const arcs: Arc[] = [];
  const out: number[][] = Array.from({ length: keys.length + 2 }, () => []);
  const addArc = (arc: Omit<Arc, 'flow' | 'reverse' | 'forward'>) => {
    const forward = arcs.length;
    arcs.push({ ...arc, flow: 0, reverse: forward + 1, forward: true });
    arcs.push({
      kind: arc.kind,
      from: arc.to,
      to: arc.from,
      capacity: 0,
      cost: -arc.cost,
      flow: 0,
      reverse: forward,
      forward: false,
    });
    out[arc.from]!.push(forward);
    out[arc.to]!.push(forward + 1);
  };
  for (const node of nodes.values()) {
    const at = index.get(node.key)!;
    if (node.hangarShips.size) {
      addArc({
        kind: 'source',
        root: 'ship',
        from: SOURCE,
        to: at,
        capacity: node.hangarShips.size,
        cost: COST.ship,
      });
    }
    if (node.always) {
      addArc({
        kind: 'source',
        root: 'always',
        from: SOURCE,
        to: at,
        capacity: UNLIMITED,
        cost: COST.always,
      });
    }
    if (node.buybackOwn.size) {
      addArc({
        kind: 'source',
        root: 'buyback',
        from: SOURCE,
        to: at,
        capacity: node.buybackOwn.size,
        cost: COST.buyback,
      });
    }
    addArc({ kind: 'sink', from: at, to: SINK, capacity: UNLIMITED, cost: 0 });
  }
  for (const entry of links.values()) {
    if (cut.has(entry)) continue;
    const from = index.get(entry.from)!;
    const to = entry.to !== undefined ? index.get(entry.to)! : SINK;
    addArc({
      kind: entry.buyback ? 'buyback' : 'hangar',
      from,
      to,
      capacity: entry.ids.length,
      cost: entry.needed ? NEEDED : entry.buyback ? COST.buybackCcu : 0,
      needed: entry.needed,
      fromKey: entry.from,
      ...(entry.to !== undefined && { toKey: entry.to }),
    });
  }
  minCostFlow(arcs, out, SOURCE, SINK);

  // The flow as single pledges along their chains: what each CCU with a discount gets.
  interface Arrival {
    root: RootKind;
    path: string[];
    buyback: boolean;
  }
  const served = new Map<string, Arrival[]>();
  const left = arcs.map((arc) => (arc.forward ? arc.flow : 0));
  /** The arcs out of a ship in the order a pledge takes them: on to other ships first. */
  const order = (at: number) =>
    out[at]!.filter((i) => arcs[i]!.forward).sort((a, b) => {
      const weight = (arc: Arc) =>
        arc.kind === 'sink' ? 3 : arc.kind === 'buyback' ? 2 : arc.to === SINK ? 1 : 0;
      return weight(arcs[a]!) - weight(arcs[b]!);
    });
  const starts = out[SOURCE]!.filter((i) => arcs[i]!.forward).sort(
    (a, b) => rank(arcs[a]!.root!) - rank(arcs[b]!.root!),
  );
  for (const start of starts) {
    while (left[start]! > 0) {
      left[start]!--;
      const root = arcs[start]!.root!;
      let at = arcs[start]!.to;
      const path: string[] = [];
      let buyback = false;
      for (let steps = 0; at !== SINK && steps <= keys.length + 1; steps++) {
        const next = order(at).find((i) => left[i]! > 0);
        if (next === undefined) break;
        left[next]!--;
        const arc = arcs[next]!;
        if (arc.needed) {
          const list = served.get(keys[at]!) ?? [];
          list.push({ root, path: [...path], buyback });
          served.set(keys[at]!, list);
        }
        if (arc.kind === 'sink') break;
        path.push(keys[at]!);
        if (arc.kind === 'buyback') buyback = true;
        at = arc.to;
      }
    }
  }

  /** The flow of the CCUs between two ships, by their kind. */
  const flowOf = (pick: (arc: Arc) => boolean) => arcs.filter((arc) => arc.forward && pick(arc));
  const sortBlocked = <T extends BlockedRoute>(list: T[]) =>
    list.sort((a, b) => b.count - a.count || (a.from < b.from ? -1 : 1));

  /** The hangar's CCUs to a ship that carry no way, also those cut from a cycle. */
  const idleOf = (key: string) => {
    const counts = new Map<string, number>();
    const add = (from: string, count: number) =>
      count && counts.set(from, (counts.get(from) ?? 0) + count);
    for (const arc of flowOf((arc) => arc.kind === 'hangar' && arc.toKey === key)) {
      add(arc.fromKey!, arc.capacity - arc.flow);
    }
    for (const entry of cut) {
      if (entry.to === key && !entry.buyback) add(entry.from, entry.ids.length);
    }
    return [...counts]
      .map(([from, count]) => ({ from, count }))
      .sort((a, b) => b.count - a.count || (a.from < b.from ? -1 : 1));
  };

  const ships = new Map<string, ChainShip>();
  const chainNodes = new Map<string, ChainNode>();
  for (const node of nodes.values()) {
    const at = index.get(node.key)!;
    const outgoing = flowOf((arc) => arc.from === at && arc.kind !== 'sink');
    const entering = flowOf((arc) => arc.to === at);
    const toTarget = new Map<string, number>();
    for (const arc of outgoing) {
      if (arc.kind === 'buyback' && arc.flow) {
        toTarget.set(arc.toKey!, (toTarget.get(arc.toKey!) ?? 0) + arc.flow);
      }
    }
    chainNodes.set(node.key, {
      key: node.key,
      ...(node.name !== undefined && { name: node.name }),
      ...(node.shipId !== undefined && { shipId: node.shipId }),
      always: node.always,
      ...(!node.always && {
        use: {
          ways: entering.reduce((sum, arc) => sum + arc.flow, 0),
          hangar: outgoing
            .filter((arc) => arc.kind === 'hangar')
            .reduce((sum, arc) => sum + arc.flow, 0),
          buyback: [...toTarget]
            .map(([to, count]) => ({ to, count }))
            .sort((a, b) => b.count - a.count || (a.to < b.to ? -1 : 1)),
          idle: idleOf(node.key),
        },
      }),
    });
    // A link only CCUs in the buy back start from gets no row.
    if (!node.needed.length && !node.others.length) continue;

    const arrivals = served.get(node.key) ?? [];
    // An always available ship giving itself isn't a way: the bar shows it as always available.
    const counted = arrivals.filter(
      (unit) => !(node.always && unit.root === 'always' && !unit.path.length),
    );
    const viaBuyback = counted.filter((unit) => unit.buyback || unit.root === 'buyback');
    const own = counted.filter((unit) => !unit.path.length && unit.root === 'ship');
    const ways: Record<WayKind, number> = {
      ship: own.length,
      chain: counted.length - viaBuyback.length - own.length,
      buyback: viaBuyback.length,
    };
    const total = counted.length;
    const short = node.always ? 0 : Math.max(0, node.needed.length - arrivals.length);

    const routes = new Map<string, ChainRoute>();
    for (const unit of counted) {
      if (!unit.path.length) continue;
      const id = `${unit.root}:${unit.buyback ? 'b' : ''}:${unit.path.join('>')}`;
      const route = routes.get(id) ?? {
        path: unit.path,
        root: unit.root,
        ...(unit.buyback && { buyback: true }),
        count: 0,
      };
      route.count++;
      routes.set(id, route);
    }
    // While short, the CCUs to it that carry no way to it.
    const unused = (kind: Arc['kind']) => {
      const counts = new Map<string, { count: number; total: number }>();
      if (!short) return counts;
      for (const arc of flowOf((arc) => arc.kind === kind && arc.toKey === node.key)) {
        const entry = counts.get(arc.fromKey!) ?? { count: 0, total: 0 };
        entry.count += arc.capacity - arc.flow;
        entry.total += arc.capacity;
        counts.set(arc.fromKey!, entry);
      }
      // CCUs that close a cycle, cut from the flow.
      for (const entry of cut) {
        if (entry.to !== node.key || entry.buyback !== (kind === 'buyback')) continue;
        const counted_ = counts.get(entry.from) ?? { count: 0, total: 0 };
        counted_.count += entry.ids.length;
        counted_.total += entry.ids.length;
        counts.set(entry.from, counted_);
      }
      return counts;
    };
    ships.set(node.key, {
      key: node.key,
      ...(node.name !== undefined && { name: node.name }),
      ...(node.shipId !== undefined && { shipId: node.shipId }),
      ccus: node.needed,
      others: node.others,
      always: node.always,
      ways,
      total,
      short,
      simpleWays: node.simpleWays,
      deepOnly: short > 0 && node.simpleWays >= node.needed.length + node.others.length,
      routes: [...routes.values()].sort((a, b) => b.count - a.count || rank(a.root) - rank(b.root)),
      blocked: sortBlocked(
        [...unused('hangar')]
          .filter(([, entry]) => entry.count)
          .map(([from, entry]) => ({ from, count: entry.count })),
      ),
      blockedBuyback: sortBlocked(
        [...unused('buyback')]
          .filter(([, entry]) => entry.count)
          .map(([from, entry]) => ({ from, ...entry })),
      ),
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
  return {
    ships,
    nodes: chainNodes,
    tooFew,
    tooFewCount: tooFew.reduce((sum, ship) => sum + ship.short, 0),
  };
}

/**
 * The links that close a cycle of CCUs (RSI sells CCUs only to pricier ships, but prices change):
 * cut from the flow, so it has no cycle. Found by a depth-first search in a fixed order.
 */
function cycleLinks<T extends { from: string; to?: string }>(
  links: readonly T[],
  keys: readonly string[],
): Set<T> {
  const byFrom = new Map<string, T[]>();
  for (const entry of links) {
    if (entry.to === undefined) continue;
    const list = byFrom.get(entry.from) ?? [];
    list.push(entry);
    byFrom.set(entry.from, list);
  }
  const state = new Map<string, 1 | 2>();
  const cut = new Set<T>();
  for (const start of keys) {
    if (state.has(start)) continue;
    const stack: { key: string; next: number }[] = [{ key: start, next: 0 }];
    state.set(start, 1);
    while (stack.length) {
      const top = stack.at(-1)!;
      const edges = byFrom.get(top.key) ?? [];
      if (top.next >= edges.length) {
        state.set(top.key, 2);
        stack.pop();
        continue;
      }
      const entry = edges[top.next++]!;
      const seen = state.get(entry.to!);
      if (seen === 1) cut.add(entry);
      else if (seen === undefined) {
        state.set(entry.to!, 1);
        stack.push({ key: entry.to!, next: 0 });
      }
    }
  }
  return cut;
}

/**
 * A min-cost flow from `source` to `sink` (successive shortest paths, Bellman-Ford in its queue
 * form): augments while a path costs less than nothing, so as many CCUs with a discount as
 * possible get a way, by the cheapest chains. The network has no cycle, so none of negative cost.
 */
function minCostFlow(arcs: Arc[], out: readonly number[][], source: number, sink: number): void {
  const size = out.length;
  for (;;) {
    const dist = new Array<number>(size).fill(Infinity);
    const via = new Array<number>(size).fill(-1);
    const queued = new Array<boolean>(size).fill(false);
    dist[source] = 0;
    const queue = [source];
    queued[source] = true;
    while (queue.length) {
      const at = queue.shift()!;
      queued[at] = false;
      for (const i of out[at]!) {
        const arc = arcs[i]!;
        if (arc.capacity - arc.flow <= 0) continue;
        const next = dist[at]! + arc.cost;
        if (next < dist[arc.to]!) {
          dist[arc.to] = next;
          via[arc.to] = i;
          if (!queued[arc.to]) {
            queued[arc.to] = true;
            queue.push(arc.to);
          }
        }
      }
    }
    if (!(dist[sink]! < 0)) return;
    let amount = Infinity;
    for (let at = sink; at !== source; at = arcs[via[at]!]!.from) {
      const arc = arcs[via[at]!]!;
      amount = Math.min(amount, arc.capacity - arc.flow);
    }
    for (let at = sink; at !== source; at = arcs[via[at]!]!.from) {
      const arc = arcs[via[at]!]!;
      arc.flow += amount;
      arcs[arc.reverse]!.flow -= amount;
    }
  }
}

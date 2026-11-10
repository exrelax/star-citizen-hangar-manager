import { DEMO } from '@/config';
import type { DemoComposition } from './generate-hangar';

/*
 * The settings of the demo mode (#178), stored with the other settings and never sent anywhere:
 * where the demo hangar comes from – generated from the public catalog (#175, the default) or a
 * selection of the own pledges –, how big it is and what it contains, and which states its
 * pledges show (#176). Changes apply at once.
 */

export const DEMO_SOURCES = ['generated', 'own'] as const;
export type DemoSource = (typeof DEMO_SOURCES)[number];

/** The states of the generated pledges that can be turned off, and how often some show. */
export interface DemoStates {
  /** Two pledges with the refund countdown, normal and in its last days. */
  refund: boolean;
  /** Pledges protected as game access (`SC`, `SQ42`, `SC · SQ42`). */
  protectedAccess: boolean;
  /** Upgraded ships with "Applied upgrades". */
  upgraded: boolean;
  /** The newest pledge bought a few hours ago. */
  justBought: boolean;
  /** A new demo hangar starts with two marks to melt, waiting and ready. */
  meltMarks: boolean;
  /** Share of pledges that can't be gifted, in percent. */
  notGiftablePercent: number;
  /** Share of pledges that can't be melted, in percent. */
  notMeltablePercent: number;
}

export interface DemoSettings {
  source: DemoSource;
  /** How many pledges of each kind the generated hangar has. */
  composition: DemoComposition;
  /** Pledges of the buy back (both sources). */
  buybackPledges: number;
  /** Pledges of the hangar when the own ones are the source. */
  ownHangarPledges: number;
  states: DemoStates;
  /** The store credit of the demo in USD (#179), instead of the account's. */
  storeCredit: number;
}

/** The range of each kind's number and of the list sizes. */
export const DEMO_LIMITS = {
  kind: { min: 0, max: 60 },
  list: { min: 10, max: 300 },
  percent: { min: 0, max: 100 },
  storeCredit: 100_000,
} as const;

export const DEFAULT_DEMO_SETTINGS: DemoSettings = {
  source: 'generated',
  composition: { ...DEMO.composition },
  buybackPledges: DEMO.buybackPledges,
  ownHangarPledges: DEMO.hangarPledges,
  states: {
    refund: true,
    protectedAccess: true,
    upgraded: true,
    justBought: true,
    meltMarks: true,
    notGiftablePercent: 30,
    notMeltablePercent: 8,
  },
  storeCredit: 50,
};

const wholeIn =
  ({ min, max }: { min: number; max: number }) =>
  (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
export const isKindCount = wholeIn(DEMO_LIMITS.kind);
export const isListSize = wholeIn(DEMO_LIMITS.list);
export const isPercent = wholeIn(DEMO_LIMITS.percent);
/** A store credit in USD, whole cents, up to `DEMO_LIMITS.storeCredit`. */
export const isDemoCredit = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= DEMO_LIMITS.storeCredit &&
  Math.round(value * 100) === value * 100;

const valid = <T>(value: unknown, isValid: (value: unknown) => value is T, fallback: T): T =>
  isValid(value) ? value : fallback;
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/** Complete demo settings from stored values, the defaults for missing or invalid ones. */
export function demoSettingsOf(stored: Partial<DemoSettings> | null | undefined): DemoSettings {
  const defaults = DEFAULT_DEMO_SETTINGS;
  const composition = Object.fromEntries(
    (Object.keys(defaults.composition) as (keyof DemoComposition)[]).map((kind) => [
      kind,
      valid(stored?.composition?.[kind], isKindCount, defaults.composition[kind]),
    ]),
  ) as unknown as DemoComposition;
  const states = stored?.states;
  return {
    source: DEMO_SOURCES.includes(stored?.source as DemoSource)
      ? (stored!.source as DemoSource)
      : defaults.source,
    composition,
    buybackPledges: valid(stored?.buybackPledges, isListSize, defaults.buybackPledges),
    ownHangarPledges: valid(stored?.ownHangarPledges, isListSize, defaults.ownHangarPledges),
    states: {
      refund: valid(states?.refund, isBoolean, defaults.states.refund),
      protectedAccess: valid(states?.protectedAccess, isBoolean, defaults.states.protectedAccess),
      upgraded: valid(states?.upgraded, isBoolean, defaults.states.upgraded),
      justBought: valid(states?.justBought, isBoolean, defaults.states.justBought),
      meltMarks: valid(states?.meltMarks, isBoolean, defaults.states.meltMarks),
      notGiftablePercent: valid(
        states?.notGiftablePercent,
        isPercent,
        defaults.states.notGiftablePercent,
      ),
      notMeltablePercent: valid(
        states?.notMeltablePercent,
        isPercent,
        defaults.states.notMeltablePercent,
      ),
    },
    storeCredit: valid(stored?.storeCredit, isDemoCredit, defaults.storeCredit),
  };
}

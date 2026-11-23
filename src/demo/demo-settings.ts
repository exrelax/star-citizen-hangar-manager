import { DEMO } from '@/config';
import { TOKEN_RENEWAL_CASES, type TokenRenewalCase } from './demo-token-renewal';
import { RUNNING_PLAN_STAGES, type RunningPlanStage } from './demo-running-plan';
import type { DemoComposition } from './generate-hangar';
import { MELT_CHECK_OUTCOMES, type MeltCheckOutcome } from './demo-melt-check';

/*
 * The settings of the demo mode (#178), stored with the other settings and never sent anywhere:
 * where the demo hangar comes from – generated from the public catalog (#175, the default) or a
 * selection of the own pledges –, how big it is and what it contains, and which states its
 * pledges show (#176). Changes apply at once.
 */

export const DEMO_SOURCES = ['generated', 'own'] as const;

export const PROTECTED_ACCESS = ['separate', 'together', 'off'] as const;
export type ProtectedAccess = (typeof PROTECTED_ACCESS)[number];
export type DemoSource = (typeof DEMO_SOURCES)[number];

/** The states of the generated pledges that can be turned off, and how often some show. */
export interface DemoStates {
  /** Two pledges with the refund countdown, normal and in its last days. */
  refund: boolean;
  /**
   * The game access protected (#176): RSI protects one pledge per game, so either one pledge for
   * each game (`SC` on a reward without a ship, `SQ42` on a game package), one for both
   * (`SC · SQ42`), or none.
   */
  protectedAccess: ProtectedAccess;
  /** Upgraded ships with "Applied upgrades". */
  upgraded: boolean;
  /** The newest pledge bought a few hours ago. */
  justBought: boolean;
  /** A new demo hangar starts with two marks to melt, waiting and ready. */
  meltMarks: boolean;
  /**
   * The Pledge Store tab shows a running event (#210); off, only the upcoming one, so the warbond
   * history offers no event period (#297).
   */
  runningEvent: boolean;
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
  /** The stage of the Paint Discount Consultant's running plan the demo shows (#303). */
  runningPlanStage: RunningPlanStage;
  /**
   * Whether the consultant has a new plan and completed plans (#306): with the stage of the running
   * plan, each set of its tabs shows – all three, two, a single one with its heading, none.
   */
  newPlan: boolean;
  completedPlans: boolean;
  /**
   * The Pledge Store tab shows the real warbond CCUs, their history, the events and the CCUs to
   * secure before a price increase (#310) – public data – instead of the demo's; what is owned
   * still comes from the demo hangar and buy back.
   */
  realStoreData: boolean;
  /**
   * How the check right before bulk melting turns out (#415, #416): all pledges match, the first
   * changed, gone or no longer meltable, or RSI not readable. Nothing is read or melted.
   */
  meltCheck: MeltCheckOutcome;
  /** The buy back tokens at the top right (#433): none or up to the most an account can have. */
  buybackTokens: number;
  /** The next renewal of the tokens in their tooltip (#434): the website's, or a case of its own. */
  tokenRenewal: TokenRenewalCase;
  /** Paints in the demo's cart on RSI's cart page (#459): 10 reach the best tier, no note then. */
  cartPaints: number;
  /**
   * CCUs without a base ship in the hangar or buy back (#425): off, the buy back gives every CCU's
   * base ship, so the CCU Consultant and its sidebar box (#115) have none.
   */
  ccuCoverageGaps: boolean;
  /**
   * CCUs whose base ship rises in price (#425): off, no base ship of a CCU does, so the CCU
   * Consultant's "Discount at risk" (#455) has none.
   */
  ccuDiscountAtRisk: boolean;
  /**
   * Pledges that can be melted and rebought without loss (#532): off, none can, so the List
   * Shortcut "Melt and rebuy" is empty.
   */
  rebuyable: boolean;
  /**
   * Browser notifications shown as allowed in this browser (#474): what a watchlist's dialog says
   * of its reminder (#469). The demo never shows a real browser notification.
   */
  browserNotifications: boolean;
  /**
   * The synced storage almost full in the settings' stored data (#560): the demo's own watchlists
   * and marks with a made-up use near its limit, and the warning.
   */
  syncedNearLimit: boolean;
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
    protectedAccess: 'separate',
    upgraded: true,
    justBought: true,
    meltMarks: true,
    runningEvent: true,
    notGiftablePercent: 30,
    notMeltablePercent: 8,
  },
  storeCredit: 50,
  runningPlanStage: 'cart',
  newPlan: true,
  completedPlans: true,
  realStoreData: false,
  meltCheck: 'match',
  buybackTokens: DEMO.maxBuybackTokens,
  tokenRenewal: 'real',
  cartPaints: 2,
  ccuCoverageGaps: true,
  ccuDiscountAtRisk: true,
  rebuyable: true,
  browserNotifications: true,
  syncedNearLimit: false,
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
      protectedAccess: PROTECTED_ACCESS.includes(states?.protectedAccess as ProtectedAccess)
        ? states!.protectedAccess
        : defaults.states.protectedAccess,
      upgraded: valid(states?.upgraded, isBoolean, defaults.states.upgraded),
      justBought: valid(states?.justBought, isBoolean, defaults.states.justBought),
      meltMarks: valid(states?.meltMarks, isBoolean, defaults.states.meltMarks),
      runningEvent: valid(states?.runningEvent, isBoolean, defaults.states.runningEvent),
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
    runningPlanStage: RUNNING_PLAN_STAGES.includes(stored?.runningPlanStage as RunningPlanStage)
      ? stored!.runningPlanStage!
      : defaults.runningPlanStage,
    newPlan: valid(stored?.newPlan, isBoolean, defaults.newPlan),
    completedPlans: valid(stored?.completedPlans, isBoolean, defaults.completedPlans),
    realStoreData: valid(stored?.realStoreData, isBoolean, defaults.realStoreData),
    meltCheck: MELT_CHECK_OUTCOMES.includes(stored?.meltCheck as MeltCheckOutcome)
      ? stored!.meltCheck!
      : defaults.meltCheck,
    buybackTokens: valid(
      stored?.buybackTokens,
      wholeIn({ min: 0, max: DEMO.maxBuybackTokens }),
      defaults.buybackTokens,
    ),
    tokenRenewal: TOKEN_RENEWAL_CASES.includes(stored?.tokenRenewal as TokenRenewalCase)
      ? stored!.tokenRenewal!
      : defaults.tokenRenewal,
    cartPaints: valid(stored?.cartPaints, wholeIn({ min: 1, max: 10 }), defaults.cartPaints),
    ccuCoverageGaps: valid(stored?.ccuCoverageGaps, isBoolean, defaults.ccuCoverageGaps),
    ccuDiscountAtRisk: valid(stored?.ccuDiscountAtRisk, isBoolean, defaults.ccuDiscountAtRisk),
    rebuyable: valid(stored?.rebuyable, isBoolean, defaults.rebuyable),
    browserNotifications: valid(
      stored?.browserNotifications,
      isBoolean,
      defaults.browserNotifications,
    ),
    syncedNearLimit: valid(stored?.syncedNearLimit, isBoolean, defaults.syncedNearLimit),
  };
}

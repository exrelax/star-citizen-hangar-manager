import type { Settings } from '@/settings/settings';
import type { FactSource, ShipFactsLookup } from '@/ships/ship-facts';
import { inject, shallowRef, type InjectionKey, type Ref } from 'vue';

/*
 * Which ships count as always available for the CCU Consultant (#110): by the source chosen in its
 * settings among the sources of the ships' facts (#109) that tell it, the first one if none or an
 * unknown one is chosen. Nothing counts while "Consider always available ships" is off. CCUs in
 * My Hangar whose base ship is on the list get the label "Always available" (#112).
 */

/** The sources of the ships' facts that tell which ships are always available. */
export const alwaysAvailableSources = (facts: ShipFactsLookup | undefined): FactSource[] =>
  facts?.sources.filter((source) => source.facts.includes('alwaysAvailable')) ?? [];

/** The source the settings choose, else the first one; none without such a source. */
export function chosenAlwaysAvailableSource(
  settings: Pick<Settings, 'ccuConsultant'>,
  facts: ShipFactsLookup | undefined,
): FactSource | undefined {
  const sources = alwaysAvailableSources(facts);
  const chosen = settings.ccuConsultant.alwaysAvailableSource;
  return sources.find((source) => source.id === chosen) ?? sources[0];
}

/**
 * Whether the base ship of a CCU (by the upgrade tool's id) counts as always available for the
 * consultant: never while the setting is off, a ship without an id or without facts about it.
 */
export function countsAsAlwaysAvailable(
  settings: Pick<Settings, 'ccuConsultant'>,
  facts: ShipFactsLookup | undefined,
  shipId: number | undefined,
): boolean {
  return shipId !== undefined && alwaysAvailableList(settings, facts)?.has(shipId) === true;
}

/** The list of always available ships the consultant uses: its source, its date and its ships. */
export interface AlwaysAvailableList {
  source: FactSource;
  /** When the list last changed (ISO), empty if not known. */
  changedAt: string;
  has: (shipId: number) => boolean;
}

/** The list by the settings; none while the setting is off or no source tells it. */
export function alwaysAvailableList(
  settings: Pick<Settings, 'ccuConsultant'>,
  facts: ShipFactsLookup | undefined,
): AlwaysAvailableList | undefined {
  if (!settings.ccuConsultant.considerAlwaysAvailable || !facts) return undefined;
  const source = chosenAlwaysAvailableSource(settings, facts);
  if (!source) return undefined;
  return {
    source,
    changedAt: facts.changedAt,
    has: (shipId) => facts.isAlwaysAvailable(shipId, source.id) === true,
  };
}

/** The date of a list, e.g. "Nov 18, 2026"; none while it isn't known. */
export function listDate(changedAt: string | undefined, locale: string): string | undefined {
  const date = changedAt ? new Date(changedAt) : undefined;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
    : undefined;
}

export const ALWAYS_AVAILABLE: InjectionKey<Readonly<Ref<AlwaysAvailableList | undefined>>> =
  Symbol('alwaysAvailable');

/** The list provided by the manager view (see `App.vue`); none outside of it. */
export function useProvidedAlwaysAvailable(): Readonly<Ref<AlwaysAvailableList | undefined>> {
  return inject(ALWAYS_AVAILABLE, shallowRef(undefined));
}

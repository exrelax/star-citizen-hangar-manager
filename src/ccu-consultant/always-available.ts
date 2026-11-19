import type { Settings } from '@/settings/settings';
import type { FactSource, ShipFactsLookup } from '@/ships/ship-facts';

/*
 * Which ships count as always available for the CCU Consultant (#110): by the source chosen in its
 * settings among the sources of the ships' facts (#109) that tell it, the first one if none or an
 * unknown one is chosen. Nothing counts while "Consider always available ships" is off.
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
  if (!settings.ccuConsultant.considerAlwaysAvailable || shipId === undefined) return false;
  const source = chosenAlwaysAvailableSource(settings, facts);
  return !!source && facts?.isAlwaysAvailable(shipId, source.id) === true;
}

/*
 * The settings of the demo mode (#178), stored with the other settings: where the demo hangar
 * comes from – generated from the public catalog (#175, the default) or a selection of the own
 * pledges with made-up ids and dates (the demo mode before).
 */

export const DEMO_SOURCES = ['generated', 'own'] as const;
export type DemoSource = (typeof DEMO_SOURCES)[number];

export interface DemoSettings {
  source: DemoSource;
}

export const DEFAULT_DEMO_SETTINGS: DemoSettings = { source: 'generated' };

/** Complete demo settings from stored values, the defaults for missing or invalid ones. */
export function demoSettingsOf(stored: Partial<DemoSettings> | null | undefined): DemoSettings {
  return {
    source: DEMO_SOURCES.includes(stored?.source as DemoSource)
      ? (stored!.source as DemoSource)
      : DEFAULT_DEMO_SETTINGS.source,
  };
}

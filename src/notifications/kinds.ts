/*
 * The kinds of notifications that can be turned off in the settings (#197), each on by default:
 * - `meltReady`: the browser notifications that marked pledges, among them the Paint Discount
 *   Consultant's filler paints, can be melted now (#153, #105). The sidebar tells it anyway.
 * - `warbonds`: new and gone warbond CCUs in the Pledge Store (#164), in the sidebar and – new
 *   ones – in the browser.
 * - `storeItems`: changed Pledge Store items (#164), in the sidebar only.
 * - `events`: an event of the project website whose display period started (#69), in the sidebar
 *   only.
 * - `priceIncreases`: buy back pledges whose price is expected to rise within the period of the
 *   settings (#193), in the sidebar, and in the browser once less than two days are left.
 * Only the kinds turned off are stored, so a kind added later starts on.
 */

export const NOTIFICATION_KINDS = [
  'meltReady',
  'warbonds',
  'storeItems',
  'events',
  'priceIncreases',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Kinds that are only browser notifications: they depend on the browser notifications setting. */
export const BROWSER_ONLY_KINDS: readonly NotificationKind[] = ['meltReady'];

/** The known kinds of a stored list, each once, in their order. */
export const notificationKindsOf = (value: unknown): NotificationKind[] =>
  Array.isArray(value) ? NOTIFICATION_KINDS.filter((kind) => value.includes(kind)) : [];

/** Whether the kind is on, by the settings' kinds turned off. */
export const isKindOn = (off: readonly NotificationKind[], kind: NotificationKind) =>
  !off.includes(kind);

/** The kinds turned off, with `kind` turned on or off. */
export const withKind = (
  off: readonly NotificationKind[],
  kind: NotificationKind,
  on: boolean,
): NotificationKind[] => notificationKindsOf(on ? off.filter((k) => k !== kind) : [...off, kind]);

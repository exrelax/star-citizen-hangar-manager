import { markRaw, shallowRef, type Component } from 'vue';
import type { BuybackView } from '@/buyback/buyback-view';
import type { IconName } from '@/icons/icon-names';
import type { PledgeView } from './pledge-view';
import { hashOfTab } from './route';

/*
 * List Shortcuts (#427, #428): a place of the Hangar Manager opens "My Hangar" or "Buy Back" with a
 * named list – a title, an icon and just the pledges it is about. A bar above the list shows the
 * title, the count of its pledges left by search and filters, what the shortcut adds, and a × to
 * leave it. Search, filters and sorting work within it; opening one clears search and filters.
 * Each list has at most one shortcut at a time, kept here, so it stays while switching tabs. It
 * goes with ×, "Reset filters", a filter turned on from outside or a jump to a pledge; while
 * nothing matches it any more, the list shows its `emptyText`. Nothing of it is stored.
 *
 * Opening one from anywhere, e.g. the own CCUs colliding with a warbond CCU (#429), by ids:
 *
 *   openListShortcut({
 *     list: 'hangar',
 *     id: `warbondCollisions:${offer.id}`,
 *     title: () => i18n.t('…', [offer.name]),
 *     icon: 'shuttle-space',
 *     ids: collidingCcus.map((ccu) => ccu.id),
 *   });
 *
 * - `id` tells shortcuts apart, e.g. for a toggle button (`isListShortcutOpen`,
 *   `toggleListShortcut`); opening another one replaces it, opening it again starts it anew.
 * - The pledges: `ids` (taken when it opens) and/or a rule `matches`, which may read reactive state
 *   (e.g. the marked pledges ready to melt) and so follows it. With both, a pledge needs both.
 * - `title` and `emptyText` are texts or functions returning them, so they follow the language.
 * - `extra`: a component shown in the bar after the count, with the prop `entries` – the pledges
 *   search and filters leave visible (e.g. the store credit they free and a watchlist button of
 *   "Melt and rebuy", #530). It renders inside the manager, so it can inject what the manager
 *   provides.
 */

/** The entries of each list a shortcut can open. */
export interface ShortcutEntries {
  hangar: PledgeView;
  buyback: BuybackView;
}
export type ShortcutList = keyof ShortcutEntries;

type Text = string | (() => string);

export interface ListShortcutDefinition<L extends ShortcutList = ShortcutList> {
  list: L;
  id: string;
  title: Text;
  icon?: IconName;
  /** The pledges by id, as they are when it opens. */
  ids?: Iterable<number>;
  /** The pledges by a rule. */
  matches?: (pledge: ShortcutEntries[L]) => boolean;
  /** Shown while no pledge of the list matches it any more; a general text by default. */
  emptyText?: Text;
  /** More in the bar after the count, with the prop `entries` (see above). */
  extra?: Component;
}

/** A shortcut while it is open, as the lists show it. */
export interface OpenListShortcut<L extends ShortcutList = ShortcutList> {
  list: L;
  id: string;
  /** When it was opened: each time is a new request (search and filters start over). */
  at: number;
  title: () => string;
  icon?: IconName;
  matches: (pledge: ShortcutEntries[L]) => boolean;
  emptyText?: () => string;
  extra?: Component;
}

type OpenShortcuts = { readonly [L in ShortcutList]: OpenListShortcut<L> | null };

/** The shortcut open in each list. */
export const listShortcuts = shallowRef<OpenShortcuts>({ hangar: null, buyback: null });

const textOf = (text: Text) => (typeof text === 'function' ? text : () => text);

/** A request of the same moment still counts as a new one. */
let lastAt = 0;
const nextAt = () => (lastAt = Math.max(Date.now(), lastAt + 1));

/** Opens the shortcut in its list and shows that list. */
export function openListShortcut<L extends ShortcutList>(definition: ListShortcutDefinition<L>) {
  const { list, id, title, icon, ids, matches, emptyText, extra } = definition;
  const idSet = ids ? new Set(ids) : undefined;
  const shortcut: OpenListShortcut<L> = {
    list,
    id,
    at: nextAt(),
    title: textOf(title),
    ...(icon && { icon }),
    matches: (pledge) => (!idSet || idSet.has(pledge.id)) && (!matches || matches(pledge)),
    ...(emptyText !== undefined && { emptyText: textOf(emptyText) }),
    ...(extra && { extra: markRaw(extra) }),
  };
  listShortcuts.value = { ...listShortcuts.value, [list]: shortcut };
  location.hash = hashOfTab(list);
}

/** Closes the shortcut of the list – only if it is `id`, when given. */
export function closeListShortcut(list: ShortcutList, id?: string): void {
  const open = listShortcuts.value[list];
  if (!open || (id !== undefined && open.id !== id)) return;
  listShortcuts.value = { ...listShortcuts.value, [list]: null };
}

/** Whether the shortcut `id` is open in the list. */
export function isListShortcutOpen(list: ShortcutList, id: string): boolean {
  return listShortcuts.value[list]?.id === id;
}

/** Opens the shortcut, or closes it while it is open (the sidebar's "Show" buttons). */
export function toggleListShortcut<L extends ShortcutList>(
  definition: ListShortcutDefinition<L>,
): void {
  if (isListShortcutOpen(definition.list, definition.id)) {
    closeListShortcut(definition.list, definition.id);
  } else openListShortcut(definition);
}

/** The open shortcut as `ManagerList` takes it (`filterRequest`), its texts in today's language. */
export function filterRequestOf<L extends ShortcutList>(shortcut: OpenListShortcut<L> | null) {
  if (!shortcut) return null;
  const { at, matches, title, icon, emptyText } = shortcut;
  return {
    at,
    matches,
    title: title(),
    ...(icon && { icon }),
    ...(emptyText && { emptyText: emptyText() }),
  };
}

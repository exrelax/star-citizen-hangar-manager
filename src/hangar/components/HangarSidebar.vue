<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import type { Settings } from '@/settings/settings';
import { useSettings } from '@/settings/use-settings';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, nextTick, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import type { PledgeView } from '../pledge-view';
import { selection, visiblePledgeIds } from '../selection';
import { moveBox, placeAt, type SidebarBox as Box } from '../sidebar';
import { summarize, type PledgeSummary } from '../summary';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useDemoContext } from '@/demo/use-demo';
import SidebarBox from './SidebarBox.vue';
import { missingCounts, useBaseShipList } from '@/ccu-consultant/use-base-ship-list';
import { openConsultant } from '@/consultants/consultants';
import { openTabAt } from '../open-tab-at';
import { BROWSER_NOTIFICATIONS_SETTING_ID, BULK_MELTING_SETTING_ID } from '@/settings/anchors';
import {
  browserNotificationsHintDismissedItem,
  browserNotificationsItem,
} from '@/notifications/browser-permission';
import BulkExchangeOverlay from './BulkExchangeOverlay.vue';
import {
  currentPlanOf,
  demoRebuyPlanItem,
  rebuyPlanItem,
} from '@/store/paint-consultant/rebuy-plan-storage';
import {
  checkOff as checkOffReal,
  hasStoreLink,
  noteDetails,
  noteText,
  openNotifications,
  type AppNotification,
} from '@/notifications/notifications';
import { checkOffDemo, demoNotificationsItem } from '@/demo/demo-notes';
import { useOpenNotifications } from '@/notifications/use-notifications';
import { meltReadyIds, useMarkedPledges } from '../use-melt-marks';
import { clearHangarFilter, hangarViewFilter, showHangarFilter } from '../view-filter';
import { formatTimeLeft } from '../melt-marks';
import { myGearHref } from '../route';
import { useNow } from '@/shared/use-now';
import { vMarkWrapped } from '@/shared/mark-wrapped';
import {
  maybePaintConsultant,
  openPaintConsultant,
} from '@/store/paint-consultant/use-paint-consultant';
import {
  demoDismissedPaintsItem,
  dismissedOf,
  dismissedPaintsItem,
  isPaintNotificationShown,
} from '@/store/paint-consultant/paint-notification';
import { useStored } from '@/storage/use-stored';
import { demoRiskNoteSeenItem, RSI_TOS_URL, riskNoteSeenItem } from '@/account-safety/risk-note';
import { FEATURES } from '@/config';
import type { BuybackView } from '@/buyback/buyback-view';
import { showBuybackFilter } from '@/buyback/buyback-filter-request';
import { isKindOn } from '@/notifications/kinds';
import {
  openWatchlist,
  saveErrorOf,
  storeWatchlist,
  watchlists,
} from '@/watchlists/use-watchlists';
import { dueReminders, withReminderDone, type Watchlist } from '@/watchlists/watchlists';
import {
  demoDismissedPriceIncreasesItem,
  dismissedPriceIncreasesItem,
  isPriceIncreaseNoteShown,
  pledgesWithinDays,
} from '@/price-increases/price-increase-notes';
import {
  advisorNoteKey,
  advisorNotes,
  demoDismissedAdvisorNotesItem,
  dismissedAdvisorNotesItem,
  withDismissed,
  type AdvisorNote,
} from '@/price-increases/advisor-notes';
import { useCcusToSecure } from '@/price-increases/use-ccus-to-secure';
import { upcomingPriceIncreases } from '@/price-increases/price-increases';
import { formatExpectedTime } from '@/price-increases/price-increase-label';
import { openCcuAdvice } from '@/price-increases/ccu-advice-request';
import {
  clearHangarFilterInclude,
  hangarFilterStates,
  includeHangarFilter,
} from '../hangar-filter-request';
import {
  openCcusToSecure,
  openCurrentWarbonds,
  openShipRemovals,
} from '@/store/open-current-warbonds';
import { useProvidedRemovalCcus } from '@/ship-removals/use-removal-ccus';
import { limitedSaleNote } from '@/ship-removals/removal-availability';
import {
  demoDismissedRemovalNotesItem,
  dismissedRemovalNotesItem,
  removalNoteKeys,
  removalNotes,
  type RemovalNote,
  type RemovalWarning,
} from '@/ship-removals/removal-notes';

/*
 * The sidebar below RSI's page navigation on the left on every tab (App.vue teleports it there),
 * a column of boxes: the notifications, the summary of the hangar's visible pledges (value,
 * discounts, number) and – with a selection – the same of the selected ones. The boxes can be
 * moved up and down by their title, with the mouse or the arrow keys, and collapsed to their title;
 * the order and the collapsed boxes are kept in the settings (see `sidebar.ts`).
 */

const props = defineProps<{
  pledges: readonly PledgeView[];
  /** The buy back, for its pledges whose price is expected to rise (#193). */
  buyback: readonly BuybackView[];
  settings: Settings;
}>();
const { update } = useSettings();

const visible = computed(() => {
  const ids = visiblePledgeIds.value;
  return ids ? props.pledges.filter((pledge) => ids.has(pledge.id)) : props.pledges;
});
const selected = computed(() => {
  const ids = selection.ids.value;
  return ids.size ? props.pledges.filter((pledge) => ids.has(pledge.id)) : [];
});
/** Selected pledges that search or filters hide. */
const hiddenSelected = computed(() => {
  const ids = visiblePledgeIds.value;
  return ids ? selected.value.filter((pledge) => !ids.has(pledge.id)).length : 0;
});

const shown = computed(() => summarize(visible.value));

// Bulk melting (an experimental setting): the selected pledges that can be exchanged.
const meltable = computed(() => selected.value.filter((pledge) => pledge.isMeltable));
const bulkExchanging = ref(false);
/** Bulk melting is off: the settings tab, at its setting. */
const openBulkMeltingSetting = () =>
  openTabAt('settings', BULK_MELTING_SETTING_ID, { highlight: true });
const chosen = computed(() => (selected.value.length ? summarize(selected.value) : undefined));

// The demo mode: its pledge ids are made up, so nothing links to RSI or melts.
const demo = useDemoContext();

const money = computed(
  () => new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD' }),
);
const number = computed(() => new Intl.NumberFormat(locale.value));
const types = (summary: PledgeSummary) =>
  summary.types
    .map(({ type, count }) => `${number.value.format(count)} ${i18n.t(`filter.${type}`)}`)
    .join(' · ');

// ---- Notifications (#142) ----

// The demo has sample notifications of its own (#210, #131), never the real ones.
const realNotes = useOpenNotifications();
const demoNotes = useStored(demoNotificationsItem);
const notes = computed(() =>
  demo.value ? openNotifications(demoNotes.value ?? []) : realNotes.value,
);
const checkOff = (ids?: readonly string[]) => (demo.value ? checkOffDemo(ids) : checkOffReal(ids));
const marked = useMarkedPledges();
const now = useNow();
const titleOf = computed(() => new Map(props.pledges.map((pledge) => [pledge.id, pledge.title])));
/** Marked pledges of the hangar that can't be melted yet, the soonest first. */
const pending = computed(() =>
  [...marked.value.values()]
    .filter((mark) => mark.meltableAt > now.value && titleOf.value.has(mark.pledgeId))
    .sort((a, b) => a.meltableAt - b.meltableAt),
);
/**
 * Marked pledges that can be melted now: one notification for all of them, which stays while
 * there are any – it can't be checked off.
 */
const readyCount = computed(() => meltReadyIds.value.size);
/** All notifications: those about marked pledges and paints to buy again, and the stored ones. */
const noteCount = computed(
  () =>
    notes.value.length +
    (readyCount.value ? 1 : 0) +
    (paintNoteCount.value ? 1 : 0) +
    (priceNoteCount.value ? 1 : 0) +
    advisorShown.value.length +
    removalShown.value.length +
    remindersShown.value.length +
    (showBrowserHint.value ? 1 : 0) +
    (showRiskNote.value ? 1 : 0),
);
const noteTime = computed(
  () => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }),
);
/** The pledge in RSI's "My Gear", if it is still in the hangar; not in the demo. */
function noteHref(note: AppNotification) {
  if (demo.value || note.pledgeId === undefined) return undefined;
  const pledge = props.pledges.find((candidate) => candidate.id === note.pledgeId);
  return pledge && myGearHref(location.pathname, pledge.page, pledge.id);
}

/** The Pledge Store tab, at the warbond CCUs (#164) or the events (#69) of the notification. */
function openStoreAt(kind: NonNullable<AppNotification['kind']>) {
  if (kind === 'events') return openTabAt('store', 'shm-events-title', { highlight: true });
  openCurrentWarbonds();
}

/** Shows only the marked pledges that can be melted now in "My Hangar", and again all (#147). */
const readyFiltered = computed(() => hangarViewFilter.value?.id === 'meltReady');
function toggleReadyFilter() {
  if (readyFiltered.value) clearHangarFilter('meltReady');
  else showHangarFilter('meltReady');
}

/** The paints the consultant would buy again are filtered in "My Hangar" (#146). */
const rebuyFiltered = computed(() => hangarViewFilter.value?.id === 'paintRebuy');
function toggleRebuyFilter() {
  if (rebuyFiltered.value) clearHangarFilter('paintRebuy');
  else showHangarFilter('paintRebuy');
}

/** Selects them, so the "Selected" box offers to melt them all at once. */
function selectReady() {
  selection.replace(meltReadyIds.value);
}

/*
 * The Paint Discount Consultant's filler paints among them (#105): those its order created, by
 * pledge id. They can be melted all at once right here (with bulk melting on). Not in the demo.
 */
const realKeptPlan = useStored(rebuyPlanItem);
const demoKeptPlan = useStored(demoRebuyPlanItem);
// The demo's own kept plan (#131), with its filler paints marked.
const keptPlan = computed(() =>
  currentPlanOf(demo.value ? demoKeptPlan.value : realKeptPlan.value),
);
const readyFillers = computed(() => {
  const purchase = keptPlan.value?.purchase;
  if (!purchase) return [];
  const ids = new Set(purchase.pledgeIds);
  return props.pledges.filter(
    (pledge) => ids.has(pledge.id) && meltReadyIds.value.has(pledge.id) && pledge.isMeltable,
  );
});
const meltingFillers = ref(false);

const TITLES = {
  notifications: 'notifications.title',
  summary: 'summary.title',
  selection: 'summary.selected',
  paintConsultant: 'consultant.boxTitle',
  ccuConsultant: 'ccuConsultant.title',
} as const;

// The CCU Consultant at first glance (#115): the CCUs without base ship, now and later, as its
// tab "Without base ship" counts them; shown while the hangar has CCUs.
const ccuList = useBaseShipList();
const ccuMissing = computed(() => missingCounts(ccuList.value));
const openCcuConsultant = () => openConsultant('ccu', { highlight: true });

// The Paint Discount Consultant at first glance (worked out once in App.vue).
const consultant = maybePaintConsultant();
/** The consultant's plan, only with at least one paint to buy again: the box shows only then. */
const rebuyPlan = computed(() => {
  const plan = consultant?.result.value?.plan;
  return plan?.own.length ? plan : undefined;
});
/** Paints already bought again (#139): their old pledges are left to melt. */
const meltNow = computed(() => consultant?.result.value?.rebought ?? []);
const meltNowCredit = computed(
  () => Math.round(meltNow.value.reduce((sum, { old }) => sum + old.meltValue, 0) * 100) / 100,
);

/*
 * The consultant's notification (#151): how many paints can be bought again with more discount,
 * until it is dismissed for exactly these paints (see `paint-notification.ts`). Not with "Hide
 * melt value" on, like the box.
 */
const realDismissed = useStored(dismissedPaintsItem);
const demoDismissed = useStored(demoDismissedPaintsItem);
const dismissedItem = () => (demo.value ? demoDismissedPaintsItem : dismissedPaintsItem);
const rebuyIds = computed(() =>
  props.settings.hideMeltValue ? [] : (rebuyPlan.value?.own.map((paint) => paint.pledgeId) ?? []),
);
/** The paints the notification counts, or 0 while it isn't shown. */
const paintNoteCount = computed(() => {
  const dismissed = demo.value ? demoDismissed.value : realDismissed.value;
  // Not before the dismissed paints are read: it would show for a moment.
  if (!dismissed || !isPaintNotificationShown(rebuyIds.value, dismissed)) return 0;
  return rebuyIds.value.length;
});
/*
 * The risk for the RSI account (#330), once: until "Got it" (synced). Not a kind of notification
 * to turn off; the settings keep it under "About".
 */
const realRiskNoteSeen = useStored(riskNoteSeenItem);
// The demo has its own (#416).
const demoRiskNoteSeen = useStored(demoRiskNoteSeenItem);
// Not before it is read: it would show for a moment. Behind a feature toggle (`config.ts`).
const showRiskNote = computed(
  () =>
    FEATURES.tosSidebarNote &&
    (demo.value ? demoRiskNoteSeen.value : realRiskNoteSeen.value) === false,
);
function confirmRiskNote() {
  void (demo.value ? demoRiskNoteSeenItem : riskNoteSeenItem).setValue(true);
}

/*
 * A hint that browser notifications can be turned on (#152), with a button to the setting, until
 * they are on in this browser or the hint is dismissed with its X (synced).
 */
const browserAllowed = useStored(browserNotificationsItem);
const browserHintDismissed = useStored(browserNotificationsHintDismissedItem);
// Not before both are read: it would show for a moment.
const showBrowserHint = computed(
  () => browserAllowed.value === false && browserHintDismissed.value === false,
);
const openBrowserNotificationsSetting = () =>
  openTabAt('settings', BROWSER_NOTIFICATIONS_SETTING_ID, { highlight: true });
function dismissBrowserHint() {
  void browserNotificationsHintDismissedItem.setValue(true);
}

/*
 * Buy back pledges whose price is expected to rise within the period of the settings (#193): one
 * notification for all of them, until it is dismissed for exactly these pledges (see
 * `price-increase-notes.ts`).
 */
const realPriceDismissed = useStored(dismissedPriceIncreasesItem);
const demoPriceDismissed = useStored(demoDismissedPriceIncreasesItem);
const priceIds = computed(() =>
  isKindOn(props.settings.notificationsOff, 'priceIncreases')
    ? pledgesWithinDays(props.buyback, now.value, props.settings.priceIncreaseDays)
    : [],
);
/** The pledges the notification counts, or 0 while it isn't shown. */
const priceNoteCount = computed(() => {
  const dismissed = demo.value ? demoPriceDismissed.value : realPriceDismissed.value;
  // Not before the dismissed pledges are read: it would show for a moment.
  if (!dismissed || !isPriceIncreaseNoteShown(priceIds.value, dismissed)) return 0;
  return priceIds.value.length;
});
function dismissPriceNote() {
  void (demo.value ? demoDismissedPriceIncreasesItem : dismissedPriceIncreasesItem).setValue(
    priceIds.value,
  );
}
const showPriceIncreases = () => showBuybackFilter('priceIncrease');

/*
 * The Price Increase Advisor (#254): per price increase within that period, the CCUs of the hangar
 * losing value by it, or – without such CCUs – that a CCU to the ship can still be bought at the
 * old price. Each is dismissed for its price increase (see `advisor-notes.ts`).
 */
const secure = useCcusToSecure(
  () => props.pledges,
  () => props.buyback,
  now,
);
const realAdvisorDismissed = useStored(dismissedAdvisorNotesItem);
const demoAdvisorDismissed = useStored(demoDismissedAdvisorNotesItem);
const advisorShown = computed((): AdvisorNote[] => {
  const dismissed = demo.value ? demoAdvisorDismissed.value : realAdvisorDismissed.value;
  // Not before the dismissed ones are read: they would show for a moment.
  if (!dismissed || !isKindOn(props.settings.notificationsOff, 'priceAdvisor')) return [];
  return advisorNotes({
    ccus: props.pledges.filter((pledge) => pledge.isCcu),
    secure: secure.value,
    now: now.value,
    days: props.settings.priceIncreaseDays,
    secureHint: props.settings.priceAdvisorSecureHint,
    dismissed,
  });
});
function dismissAdvisorNote(note: AdvisorNote) {
  const item = demo.value ? demoDismissedAdvisorNotesItem : dismissedAdvisorNotesItem;
  const dismissed = (demo.value ? demoAdvisorDismissed.value : realAdvisorDismissed.value) ?? [];
  // The keys of the increases still ahead, of the hangar's CCUs and of the CCUs to secure.
  const ahead = new Set(
    upcomingPriceIncreases(
      [
        ...props.pledges.flatMap((pledge) => pledge.ccuPriceChange?.base ?? []),
        ...secure.value.map((offer) => offer.increase),
      ],
      now.value,
    ).map(advisorNoteKey),
  );
  void item.setValue(withDismissed(dismissed, note.key, ahead));
}
const advisorWhen = (note: AdvisorNote) =>
  formatExpectedTime(note.increase.priceIncreaseAt, locale.value);
function advisorText(note: AdvisorNote) {
  const ship = note.increase.ship.name;
  if (note.kind === 'secure')
    return i18n.t('notifications.advisorSecure', [ship, advisorWhen(note)]);
  const count = note.ccuIds.length;
  const args = [number.value.format(count), ship, advisorWhen(note)];
  if (note.loss === undefined) return i18n.n('notifications.advisorLosing', count, args);
  const loss = money.value.format(note.loss);
  return i18n.n('notifications.advisorLoss', count, [...args, loss]);
}
/** "Price change ahead" is on in My Hangar: the button turns it off again, like the others. */
const advisorFiltered = computed(() => hangarFilterStates.value.get('priceChange') === 'include');
function toggleAdvisorFilter() {
  if (advisorFiltered.value) clearHangarFilterInclude('priceChange');
  else includeHangarFilter('priceChange');
}
const openSecureSection = openCcusToSecure;

/*
 * The ships leaving the Pledge Store (#290): one notification per date with all its ships, and a
 * warning for those with CCUs from them – red with fewer CCUs to the ship than from it. Each is
 * dismissed for its ships on its date (see `removal-notes.ts`).
 */
const removalCcus = useProvidedRemovalCcus();
const realRemovalDismissed = useStored(dismissedRemovalNotesItem);
const demoRemovalDismissed = useStored(demoDismissedRemovalNotesItem);
const removalShown = computed((): RemovalNote[] => {
  const dismissed = demo.value ? demoRemovalDismissed.value : realRemovalDismissed.value;
  // Not before the dismissed ones are read: they would show for a moment.
  if (!dismissed || !isKindOn(props.settings.notificationsOff, 'shipRemovals')) return [];
  return removalNotes(removalCcus.value.list, now.value, dismissed);
});
function dismissRemovalNote(note: RemovalNote) {
  const item = demo.value ? demoDismissedRemovalNotesItem : dismissedRemovalNotesItem;
  const dismissed = (demo.value ? demoRemovalDismissed.value : realRemovalDismissed.value) ?? [];
  const ahead = removalNoteKeys(
    removalCcus.value.list.map((entry) => entry.removal),
    now.value,
  );
  void item.setValue(withDismissed(dismissed, note.key, ahead));
}
/*
 * The reminders of watchlists whose date has come (#469): one per watchlist, opening it. Its ×
 * dismisses it for this date on the watchlist itself, so it follows to other devices and a new date
 * reminds again.
 */
const remindersShown = computed(() =>
  isKindOn(props.settings.notificationsOff, 'watchlistReminders')
    ? dueReminders(watchlists.value, now.value)
    : [],
);
const reminderError = ref<string>();
function dismissReminder(list: Watchlist) {
  reminderError.value = undefined;
  storeWatchlist(withReminderDone(list)).catch(
    (cause: unknown) => (reminderError.value = saveErrorOf(cause)),
  );
}
const reminderText = (list: Watchlist) =>
  i18n.t('notifications.watchlistReminder', [list.name, noteTime.value.format(list.dueAt)]);

/** One ship: its name; several: their count, each listed below. */
function removalText(note: RemovalNote) {
  const when = formatExpectedTime(note.removedAt, locale.value);
  return i18n.n('notifications.shipRemovals', note.ships.length, [
    note.ships[0]!.ship.name,
    when,
    number.value.format(note.ships.length),
  ]);
}
/** The ships of the date on sale now but not always available (#293), as one note. */
const removalLimited = (note: RemovalNote) =>
  limitedSaleNote(note.ships, removalCcus.value.limited, locale.value);
/** The ships of the date without CCUs from them, by name. */
const removalOthers = (note: RemovalNote) => {
  const warned = new Set(note.warnings.map((warning) => warning.removal.ship.id));
  return note.ships.filter((removal) => !warned.has(removal.ship.id));
};
const removalWarningText = (warning: RemovalWarning) =>
  i18n.n('notifications.shipRemovalCcus', warning.from, [
    warning.removal.ship.name,
    number.value.format(warning.from),
    number.value.format(warning.to),
  ]);

function dismissPaintNote() {
  void dismissedItem().setValue(dismissedOf(rebuyIds.value));
}

// ---- Order and collapsed boxes ----

/**
 * A setting changed here until the settings have it: they are passed in from the manager and
 * change only once the stored settings did, so the boxes would jump back in between.
 */
function usePending(source: () => Box[]) {
  const pending = ref<Box[]>();
  watch(source, () => (pending.value = undefined));
  return {
    value: computed(() => pending.value ?? source()),
    set: (value: Box[]) => (pending.value = value),
  };
}

const savedOrder = usePending(() => props.settings.sidebarOrder);
const savedCollapsed = usePending(() => props.settings.sidebarCollapsed);
const current = savedOrder.value;

/** While dragging: the order the boxes would get when dropped there. */
const preview = ref<Box[]>();
const order = computed(() => preview.value ?? current.value);
const isShown = (box: Box) =>
  !props.settings.sidebarHidden.includes(box) &&
  (box === 'selection'
    ? !!chosen.value
    : box === 'notifications'
      ? noteCount.value > 0
      : box === 'paintConsultant'
        ? !props.settings.hideMeltValue && (!!rebuyPlan.value || meltNow.value.length > 0)
        : box === 'ccuConsultant'
          ? ccuList.value.total > 0
          : true);
const boxes = computed(() => order.value.filter(isShown));

const isCollapsed = (box: Box) => savedCollapsed.value.value.includes(box);
function toggle(box: Box) {
  const collapsed = savedCollapsed.value.value;
  const next = isCollapsed(box) ? collapsed.filter((other) => other !== box) : [...collapsed, box];
  savedCollapsed.set(next);
  void update({ sidebarCollapsed: next });
}

function save(next: Box[]) {
  if (next.join() === current.value.join()) return false;
  // A plain array: the browser would store Vue's reactive one as an object.
  const plain = [...next];
  savedOrder.set(plain);
  void update({ sidebarOrder: plain });
  return true;
}

const root = useTemplateRef('root');
/** The place of a box in the sidebar; the box in it moves away from it while dragged or animated. */
const slotOf = (box: Box) => root.value?.querySelector<HTMLElement>(`[data-box="${box}"]`);
const boxOf = (box: Box) => slotOf(box)?.firstElementChild as HTMLElement | null | undefined;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lets a box glide from `offset` pixels above or below to its place. */
function glide(element: HTMLElement | null | undefined, offset: number) {
  if (!element || Math.abs(offset) < 1 || reducedMotion()) return;
  element.animate([{ transform: `translateY(${offset}px)` }, { transform: 'none' }], {
    duration: 200,
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
  });
}

// ---- Dragging ----

const dragged = ref<Box>();
/** Where the pointer is, and where in the dragged box it took hold of it. */
let pointerY = 0;
let holdY = 0;
/** How far the dragged box is moved away from its place. */
let offset = 0;
/** The pointer that holds the box; others (a second finger) don't move it. */
let pointerId: number | undefined;

/*
 * While dragging, the window follows the pointer: the boxes move in the page meanwhile, and an
 * element that is moved loses the pointer.
 */
function grab(box: Box, event: PointerEvent) {
  const element = boxOf(box);
  if (!element) return;
  dragged.value = box;
  preview.value = [...current.value];
  pointerId = event.pointerId;
  pointerY = event.clientY;
  holdY = event.clientY - element.getBoundingClientRect().top;
  offset = 0;
  addEventListener('pointermove', drag);
  addEventListener('pointerup', drop);
  addEventListener('pointercancel', drop);
}

/** Keeps the dragged box under the pointer, within the sidebar. */
function follow() {
  const box = dragged.value;
  const slot = box && slotOf(box);
  const element = box && boxOf(box);
  const sidebar = root.value?.getBoundingClientRect();
  if (!slot || !element || !sidebar) return;
  const top = Math.min(
    Math.max(pointerY - holdY, sidebar.top),
    sidebar.bottom - element.offsetHeight,
  );
  offset = top - slot.getBoundingClientRect().top;
  element.style.transform = `translateY(${offset}px)`;
}

/**
 * Moves the dragged box's place by the pointer (see `placeAt`). The others are measured as if the
 * dragged box weren't there, so the order doesn't flip back and forth when boxes have different
 * heights.
 */
async function drag(event: PointerEvent) {
  const box = dragged.value;
  const slot = box && slotOf(box);
  if (!box || !slot || !preview.value || !root.value || event.pointerId !== pointerId) return;
  pointerY = event.clientY;
  follow();

  const gap = parseFloat(getComputedStyle(root.value).rowGap) || 0;
  const shift = slot.offsetHeight + gap;
  const index = preview.value.indexOf(box);
  const others = boxes.value.filter((other) => other !== box);
  const middles = others.flatMap((other) => {
    const rect = slotOf(other)?.getBoundingClientRect();
    if (!rect) return [];
    const top = rect.top - (preview.value!.indexOf(other) > index ? shift : 0);
    return [{ box: other, middle: top + rect.height / 2 }];
  });
  const next = placeAt(preview.value, box, middles, pointerY);
  if (next.join() === preview.value.join()) return;

  // The other boxes glide to their new places (FLIP: measure, reorder, measure, animate).
  const before = new Map(others.map((other) => [other, boxOf(other)?.getBoundingClientRect().top]));
  preview.value = next;
  await nextTick();
  follow();
  for (const other of others) {
    const element = boxOf(other);
    const old = before.get(other);
    if (element && old !== undefined) glide(element, old - element.getBoundingClientRect().top);
  }
}

/** The dragged box glides into its place. */
function drop(event?: PointerEvent) {
  if (event && event.pointerId !== pointerId) return;
  removeEventListener('pointermove', drag);
  removeEventListener('pointerup', drop);
  removeEventListener('pointercancel', drop);
  const box = dragged.value;
  if (!box) return;
  const element = boxOf(box);
  if (element) {
    element.style.transform = '';
    glide(element, offset);
  }
  const next = preview.value;
  dragged.value = undefined;
  preview.value = undefined;
  if (next) save(next);
}

onUnmounted(() => drop());

/** For screen readers: where a box moved with the keyboard is now. */
const announcement = ref('');

async function move(box: Box, step: -1 | 1) {
  const others = boxes.value.filter((other) => other !== box);
  const before = new Map(
    boxes.value.map((other) => [other, boxOf(other)?.getBoundingClientRect().top]),
  );
  if (!save(moveBox(current.value, box, step, boxes.value))) return;
  await nextTick();
  for (const other of [box, ...others]) {
    const element = boxOf(other);
    const old = before.get(other);
    if (element && old !== undefined) glide(element, old - element.getBoundingClientRect().top);
  }
  // Moving the element in the page can take the focus away from its handle.
  boxOf(box)?.querySelector<HTMLElement>('.shm-sidebar-handle')?.focus();
  announcement.value = i18n.t('sidebar.moved', [boxes.value.indexOf(box) + 1, boxes.value.length]);
}
</script>

<template>
  <div
    v-if="boxes.length"
    ref="root"
    class="shm-sidebar"
    :class="[themeClasses(settings), { 'is-sorting': dragged }]"
    :style="fontScaleStyle(settings)"
    role="region"
    :aria-label="i18n.t('sidebar.label')"
  >
    <div v-for="box in boxes" :key="box" class="shm-sidebar-slot" :data-box="box">
      <SidebarBox
        :title="i18n.t(TITLES[box])"
        :badge="box === 'notifications' && noteCount ? number.format(noteCount) : undefined"
        :badge-label="
          box === 'notifications' && noteCount
            ? i18n.n('notifications.count', noteCount, [number.format(noteCount)])
            : undefined
        "
        :dragging="box === dragged"
        :collapsed="isCollapsed(box)"
        @grab="(event) => grab(box, event)"
        @move="(step) => move(box, step)"
        @toggle="toggle(box)"
      >
        <template v-if="box === 'notifications'">
          <!-- Only shown with at least one notification (see `isShown`). -->
          <!-- First: the account's risk, until "Got it" (#330). -->
          <div v-if="showRiskNote" class="shm-sidebar-melt-ready" role="note">
            <SvgIcon name="triangle-exclamation" />
            <p>
              <strong>{{ i18n.t('accountSafety.title') }}</strong>
              {{ i18n.t('accountSafety.note') }}
              <a
                v-tooltip="i18n.t('accountSafety.tosHint')"
                :href="RSI_TOS_URL"
                target="_blank"
                rel="noopener noreferrer"
                >{{ i18n.t('accountSafety.tos') }}</a
              >
            </p>
            <div v-mark-wrapped class="shm-sidebar-actions">
              <button
                v-tooltip="i18n.t('accountSafety.gotItHint')"
                type="button"
                class="shm-button shm-sidebar-button"
                @click="confirmRiskNote"
              >
                <SvgIcon name="check" />
                {{ i18n.t('accountSafety.gotIt') }}
              </button>
            </div>
          </div>
          <div v-if="readyCount" class="shm-sidebar-melt-ready" role="status">
            <SvgIcon name="recycle" />
            <p>
              {{ i18n.n('notifications.meltReady', readyCount, [number.format(readyCount)]) }}
            </p>
            <div v-mark-wrapped class="shm-sidebar-actions">
              <button
                v-tooltip="
                  i18n.t(
                    readyFiltered ? 'notifications.showAllHint' : 'notifications.showReadyHint',
                  )
                "
                type="button"
                class="shm-button shm-sidebar-button"
                :aria-pressed="readyFiltered"
                @click="toggleReadyFilter"
              >
                <SvgIcon :name="readyFiltered ? 'filter-circle-xmark' : 'filter'" />
                {{ i18n.t(readyFiltered ? 'notifications.showAll' : 'notifications.showReady') }}
              </button>
              <button
                v-tooltip="i18n.t('notifications.selectReadyHint')"
                type="button"
                class="shm-button shm-sidebar-button"
                @click="selectReady"
              >
                <SvgIcon name="circle-check" />
                {{ i18n.t('notifications.selectReady') }}
              </button>
            </div>
            <!-- Among them the consultant's filler paints (#105): all of them at once. -->
            <template v-if="readyFillers.length">
              <p class="shm-sidebar-note">
                {{
                  i18n.n('consultant.fillers.amongReady', readyFillers.length, [
                    number.format(readyFillers.length),
                  ])
                }}
              </p>
              <div class="shm-sidebar-actions">
                <button
                  v-if="settings.bulkMelting"
                  v-tooltip="i18n.t('consultant.fillers.meltHint')"
                  type="button"
                  class="shm-button is-danger shm-sidebar-button is-full"
                  @click="meltingFillers = true"
                >
                  <SvgIcon name="triangle-exclamation" />
                  {{ i18n.n('consultant.fillers.melt', readyFillers.length) }}
                </button>
                <button
                  v-else
                  v-tooltip="i18n.t('bulkExchange.disabledHint')"
                  type="button"
                  class="shm-button shm-sidebar-button is-full"
                  @click="openBulkMeltingSetting"
                >
                  <SvgIcon name="gear" />
                  {{ i18n.t('bulkExchange.disabled') }}
                </button>
              </div>
              <BulkExchangeOverlay
                v-if="meltingFillers"
                :pledges="readyFillers"
                :hangar="pledges"
                :skipped="0"
                @close="meltingFillers = false"
              />
            </template>
          </div>
          <div v-if="paintNoteCount" class="shm-sidebar-melt-ready is-dismissable" role="status">
            <SvgIcon name="paintbrush" />
            <p>
              {{
                i18n.n('notifications.paintsRebuy', paintNoteCount, [number.format(paintNoteCount)])
              }}
            </p>
            <button
              v-tooltip="i18n.t('notifications.dismissPaintsHint')"
              type="button"
              class="shm-sidebar-icon-button shm-sidebar-note-dismiss"
              :aria-label="i18n.t('notifications.dismiss')"
              @click="dismissPaintNote"
            >
              <SvgIcon name="xmark" />
            </button>
          </div>
          <div v-if="priceNoteCount" class="shm-sidebar-melt-ready is-dismissable" role="status">
            <SvgIcon name="triangle-exclamation" />
            <p>
              {{
                i18n.n('notifications.priceIncrease', priceNoteCount, [
                  number.format(priceNoteCount),
                  settings.priceIncreaseDays,
                ])
              }}
            </p>
            <button
              v-tooltip="i18n.t('notifications.dismissPriceIncreaseHint')"
              type="button"
              class="shm-sidebar-icon-button shm-sidebar-note-dismiss"
              :aria-label="i18n.t('notifications.dismiss')"
              @click="dismissPriceNote"
            >
              <SvgIcon name="xmark" />
            </button>
            <div v-mark-wrapped class="shm-sidebar-actions">
              <button
                v-tooltip="i18n.t('notifications.showPriceIncreaseHint')"
                type="button"
                class="shm-button shm-sidebar-button"
                @click="showPriceIncreases"
              >
                <SvgIcon name="filter" />
                {{ i18n.t('notifications.showReady') }}
              </button>
            </div>
          </div>
          <div
            v-for="note in advisorShown"
            :key="note.key"
            class="shm-sidebar-melt-ready is-dismissable"
            role="status"
          >
            <SvgIcon :name="note.kind === 'losing' ? 'triangle-exclamation' : 'circle-info'" />
            <p>{{ advisorText(note) }}</p>
            <button
              v-tooltip="i18n.t('notifications.dismissAdvisorHint')"
              type="button"
              class="shm-sidebar-icon-button shm-sidebar-note-dismiss"
              :aria-label="i18n.t('notifications.dismiss')"
              @click="dismissAdvisorNote(note)"
            >
              <SvgIcon name="xmark" />
            </button>
            <div v-mark-wrapped class="shm-sidebar-actions">
              <template v-if="note.kind === 'losing'">
                <button
                  v-tooltip="
                    i18n.t(
                      advisorFiltered
                        ? 'notifications.showAllHint'
                        : 'notifications.showAdvisorHint',
                    )
                  "
                  type="button"
                  class="shm-button shm-sidebar-button"
                  :aria-pressed="advisorFiltered"
                  @click="toggleAdvisorFilter"
                >
                  <SvgIcon :name="advisorFiltered ? 'filter-circle-xmark' : 'filter'" />
                  {{
                    i18n.t(advisorFiltered ? 'notifications.showAll' : 'notifications.showReady')
                  }}
                </button>
                <button
                  v-tooltip="i18n.t('notifications.openAdvisorHint')"
                  type="button"
                  class="shm-button is-warning shm-sidebar-button"
                  @click="openCcuAdvice(note.ccuIds[0])"
                >
                  <SvgIcon name="scale-balanced" />
                  {{ i18n.t('ccuAdvice.button') }}
                </button>
              </template>
              <button
                v-else
                v-tooltip="i18n.t('notifications.showSecureHint')"
                type="button"
                class="shm-button shm-sidebar-button"
                @click="openSecureSection"
              >
                <SvgIcon name="basket-shopping" />
                {{ i18n.t('notifications.showInStore') }}
              </button>
            </div>
          </div>
          <div
            v-for="note in removalShown"
            :key="note.key"
            class="shm-sidebar-melt-ready is-dismissable shm-sidebar-removal"
            :class="note.level && `is-${note.level}`"
            role="status"
          >
            <SvgIcon :name="note.level ? 'triangle-exclamation' : 'circle-info'" />
            <p>{{ removalText(note) }}</p>
            <button
              v-tooltip="i18n.t('notifications.dismissShipRemovalsHint')"
              type="button"
              class="shm-sidebar-icon-button shm-sidebar-note-dismiss"
              :aria-label="i18n.t('notifications.dismiss')"
              @click="dismissRemovalNote(note)"
            >
              <SvgIcon name="xmark" />
            </button>
            <!-- Every ship of the date: those with CCUs from them first, each in the color of its
                 level (#287), then the others by name. -->
            <ul
              v-if="note.ships.length > 1 || note.warnings.length"
              class="shm-sidebar-removal-warnings"
            >
              <li
                v-for="warning in note.warnings"
                :key="warning.removal.ship.id"
                :class="`is-${warning.level}`"
              >
                <SvgIcon name="triangle-exclamation" />
                <span>{{ removalWarningText(warning) }}</span>
              </li>
              <li v-for="ship in removalOthers(note)" :key="ship.ship.id" class="is-plain">
                <span>{{ ship.ship.name }}</span>
              </li>
            </ul>
            <p v-if="removalLimited(note)" class="shm-sidebar-note shm-sidebar-removal-limited">
              {{ removalLimited(note) }}
            </p>
            <div v-mark-wrapped class="shm-sidebar-actions">
              <button
                v-tooltip="i18n.t('notifications.showShipRemovalsHint')"
                type="button"
                class="shm-button shm-sidebar-button"
                @click="openShipRemovals"
              >
                <SvgIcon name="basket-shopping" />
                {{ i18n.t('notifications.showInStore') }}
              </button>
            </div>
          </div>
          <div
            v-for="list in remindersShown"
            :key="list.id"
            class="shm-sidebar-melt-ready is-dismissable shm-sidebar-reminder"
            role="status"
          >
            <SvgIcon name="bell" />
            <p>{{ reminderText(list) }}</p>
            <button
              v-tooltip="i18n.t('notifications.dismissWatchlistReminderHint')"
              type="button"
              class="shm-sidebar-icon-button shm-sidebar-note-dismiss"
              :aria-label="i18n.t('notifications.dismiss')"
              @click="dismissReminder(list)"
            >
              <SvgIcon name="xmark" />
            </button>
            <p v-if="list.description" class="shm-sidebar-note shm-sidebar-reminder-text">
              {{ list.description }}
            </p>
            <p v-if="reminderError" class="shm-sidebar-note is-error" role="alert">
              {{ reminderError }}
            </p>
            <div v-mark-wrapped class="shm-sidebar-actions">
              <button
                type="button"
                class="shm-button shm-sidebar-button"
                @click="openWatchlist(list.id)"
              >
                <SvgIcon name="clipboard-list" />
                {{ i18n.t('notifications.showWatchlist') }}
              </button>
            </div>
          </div>
          <div v-if="showBrowserHint" class="shm-sidebar-melt-ready is-dismissable" role="status">
            <SvgIcon name="bell" />
            <p>{{ i18n.t('notifications.browserHint') }}</p>
            <button
              v-tooltip="i18n.t('notifications.dismissBrowserHintHint')"
              type="button"
              class="shm-sidebar-icon-button shm-sidebar-note-dismiss"
              :aria-label="i18n.t('notifications.dismiss')"
              @click="dismissBrowserHint"
            >
              <SvgIcon name="xmark" />
            </button>
            <div v-mark-wrapped class="shm-sidebar-actions">
              <button
                v-tooltip="i18n.t('notifications.browserHintOpenHint')"
                type="button"
                class="shm-button shm-sidebar-button"
                @click="openBrowserNotificationsSetting"
              >
                <SvgIcon name="gear" />
                {{ i18n.t('notifications.browserHintOpen') }}
              </button>
            </div>
          </div>
          <ul v-if="notes.length" class="shm-sidebar-notes">
            <li v-for="note in notes" :key="note.id">
              <span class="shm-sidebar-note-text">
                <a v-if="noteHref(note)" :href="noteHref(note)">{{ noteText(note, locale) }}</a>
                <template v-else>{{ noteText(note, locale) }}</template>
                <time class="shm-sidebar-note">{{ noteTime.format(note.at) }}</time>
                <!-- Changed Pledge Store items: the count first, the list on demand (#164). -->
                <details v-if="noteDetails(note, locale).length" class="shm-sidebar-note-details">
                  <summary>{{ i18n.t('notifications.showChanges') }}</summary>
                  <ul>
                    <li v-for="(line, index) in noteDetails(note, locale)" :key="index">
                      {{ line }}
                    </li>
                  </ul>
                </details>
                <!-- Only where the Pledge Store tab shows the change (#276). -->
                <button
                  v-if="note.kind && hasStoreLink(note)"
                  type="button"
                  class="shm-sidebar-link shm-sidebar-note-link"
                  @click="openStoreAt(note.kind)"
                >
                  {{ i18n.t('notifications.showInStore') }}
                </button>
              </span>
              <!-- An × like the other notifications' dismiss buttons: checks it off (#164). -->
              <button
                v-tooltip="i18n.t('notifications.checkOff')"
                type="button"
                class="shm-sidebar-icon-button shm-sidebar-note-dismiss"
                :aria-label="`${i18n.t('notifications.checkOff')}: ${noteText(note, locale)}`"
                @click="checkOff([note.id])"
              >
                <SvgIcon name="xmark" />
              </button>
            </li>
          </ul>
          <button
            v-if="notes.length > 1"
            type="button"
            class="shm-sidebar-link"
            @click="checkOff()"
          >
            {{ i18n.t('notifications.checkOffAll') }}
          </button>
          <!-- What comes later: the marked pledges with the time left. -->
          <template v-if="pending.length">
            <p class="shm-sidebar-subtitle">{{ i18n.t('notifications.pending') }}</p>
            <ul class="shm-sidebar-pending">
              <li v-for="mark in pending" :key="mark.pledgeId">
                <span class="shm-sidebar-pending-title">{{ titleOf.get(mark.pledgeId) }}</span>
                <span class="shm-sidebar-note">
                  {{ i18n.t('meltMark.waiting', [formatTimeLeft(mark.meltableAt - now, locale)]) }}
                </span>
              </li>
            </ul>
          </template>
        </template>

        <template v-else-if="box === 'summary'">
          <dl class="shm-sidebar-figures">
            <div>
              <dt>{{ i18n.t('summary.count') }}</dt>
              <dd>{{ number.format(shown.count) }}</dd>
            </div>
            <template v-if="!settings.hideMeltValue">
              <div>
                <dt>{{ i18n.t('summary.value') }}</dt>
                <dd>{{ money.format(shown.value) }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('summary.discount') }}</dt>
                <dd class="is-discount">{{ money.format(shown.discount) }}</dd>
              </div>
            </template>
          </dl>
          <p v-if="settings.summaryTypes && shown.types.length" class="shm-sidebar-note">
            {{ types(shown) }}
          </p>
        </template>

        <template v-else-if="box === 'selection' && chosen">
          <dl class="shm-sidebar-figures">
            <div>
              <dt>{{ i18n.t('summary.count') }}</dt>
              <dd>{{ number.format(chosen.count) }}</dd>
            </div>
            <template v-if="!settings.hideMeltValue">
              <div>
                <dt>{{ i18n.t('summary.value') }}</dt>
                <dd>{{ money.format(chosen.value) }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('summary.discount') }}</dt>
                <dd class="is-discount">{{ money.format(chosen.discount) }}</dd>
              </div>
            </template>
          </dl>
          <!-- Always per type here; only the "Summary" box makes it a setting. -->
          <p v-if="chosen.types.length" class="shm-sidebar-note">
            {{ types(chosen) }}
          </p>
          <p v-if="hiddenSelected" class="shm-sidebar-note is-warning" role="status">
            {{ i18n.t('summary.hidden', [hiddenSelected]) }}
          </p>
          <div v-if="meltable.length" class="shm-sidebar-actions">
            <!-- Opens the dialog in the demo too; there its melt button is disabled. -->
            <button
              v-if="settings.bulkMelting"
              v-tooltip="i18n.t('bulkExchange.buttonHint')"
              type="button"
              class="shm-button is-danger shm-sidebar-button is-full"
              @click="bulkExchanging = true"
            >
              <SvgIcon name="triangle-exclamation" />
              {{ i18n.t('bulkExchange.button', [meltable.length]) }}
            </button>
            <!-- Off: points to the experimental setting, so the feature can be found (#159). -->
            <button
              v-else
              v-tooltip="i18n.t('bulkExchange.disabledHint')"
              type="button"
              class="shm-button shm-sidebar-button is-full"
              @click="openBulkMeltingSetting"
            >
              <SvgIcon name="gear" />
              {{ i18n.t('bulkExchange.disabled') }}
            </button>
          </div>
          <BulkExchangeOverlay
            v-if="bulkExchanging"
            :pledges="meltable"
            :hangar="pledges"
            :skipped="selected.length - meltable.length"
            @close="bulkExchanging = false"
          />
        </template>

        <!-- Only shown with at least one paint to buy again (see `isShown`). -->
        <template v-else-if="box === 'paintConsultant' && (rebuyPlan || meltNow.length)">
          <dl class="shm-sidebar-figures">
            <!-- Bought again already (#139): the old pledges are left to melt. -->
            <template v-if="meltNow.length">
              <div>
                <dt v-tooltip="i18n.t('consultant.boxMeltNowHint')">
                  {{ i18n.t('consultant.boxMeltNow') }}
                </dt>
                <dd>{{ number.format(meltNow.length) }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('consultant.boxMeltNowCredit') }}</dt>
                <dd>{{ money.format(meltNowCredit) }}</dd>
              </div>
            </template>
            <template v-if="rebuyPlan">
              <div>
                <dt>{{ i18n.t('consultant.boxPaints') }}</dt>
                <dd>{{ number.format(rebuyPlan.own.length) }}</dd>
              </div>
              <div>
                <dt v-tooltip="i18n.t('consultant.freedHint')">
                  {{ i18n.t('consultant.freed') }}
                </dt>
                <dd class="is-discount">{{ money.format(rebuyPlan.storeCreditFreed) }}</dd>
              </div>
            </template>
          </dl>
          <div class="shm-sidebar-actions">
            <!-- Shows only these paints in My Hangar, and again all (#146). -->
            <button
              v-tooltip="
                i18n.t(rebuyFiltered ? 'consultant.boxUnfilterHint' : 'consultant.boxFilterHint')
              "
              type="button"
              class="shm-button shm-sidebar-button"
              :aria-pressed="rebuyFiltered"
              @click="toggleRebuyFilter"
            >
              <SvgIcon :name="rebuyFiltered ? 'filter-circle-xmark' : 'filter'" />
              {{ i18n.t(rebuyFiltered ? 'consultant.boxUnfilter' : 'consultant.boxFilter') }}
            </button>
            <button
              type="button"
              class="shm-button shm-sidebar-button"
              @click="openPaintConsultant(meltNow.length ? 'running' : 'new')"
            >
              <SvgIcon name="user-tie" />
              {{ i18n.t('consultant.boxOpen') }}
            </button>
          </div>
        </template>

        <!-- Shown while the hangar has CCUs (see `isShown`). -->
        <template v-else-if="box === 'ccuConsultant'">
          <dl v-if="ccuMissing.total" class="shm-sidebar-figures">
            <div>
              <dt v-tooltip="i18n.t('ccuConsultant.boxMissingHint')">
                {{ i18n.t('ccuConsultant.standing.missing') }}
              </dt>
              <dd :class="{ 'is-warning': ccuMissing.missing }">
                {{ number.format(ccuMissing.missing) }}
              </dd>
            </div>
            <div v-if="ccuMissing.soon">
              <dt>{{ i18n.t('ccuConsultant.soon.title') }}</dt>
              <dd class="is-warning">{{ number.format(ccuMissing.soon) }}</dd>
            </div>
            <div v-if="ccuMissing.tooFew">
              <dt v-tooltip="i18n.t('ccuConsultant.boxTooFewHint')">
                {{ i18n.t('ccuConsultant.boxTooFew') }}
              </dt>
              <dd class="is-warning">{{ number.format(ccuMissing.tooFew) }}</dd>
            </div>
          </dl>
          <p v-else class="shm-sidebar-ok">
            <SvgIcon name="circle-check" />
            {{ i18n.t('ccuConsultant.empty.missing') }}
          </p>
          <div class="shm-sidebar-actions">
            <button type="button" class="shm-button shm-sidebar-button" @click="openCcuConsultant">
              <SvgIcon name="link" />
              {{ i18n.t('ccuConsultant.boxOpen') }}
            </button>
          </div>
        </template>

        <template v-if="box === 'selection'" #actions>
          <button
            v-tooltip="i18n.t('summary.clear')"
            type="button"
            class="shm-sidebar-icon-button"
            :aria-label="i18n.t('summary.clear')"
            @click="selection.clear()"
          >
            <SvgIcon name="xmark" />
          </button>
        </template>
      </SidebarBox>
    </div>
    <p class="shm-sidebar-status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style>
/* A column of boxes; the gap between them is the same in both themes. */
.shm-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
  line-height: 1.4;
}

/*
 * Classic RSI: it ends where RSI's navigation items end (their background stops 21 px before the
 * column's edge), so it keeps a gap to the manager, which starts right after the column.
 */
.shm-sidebar.shm-theme-rsi {
  width: calc(100% - 21px);
}

/* Classic RSI: square, outlined like RSI's own boxes. "Modern Hangar": modern.css. */
.shm-sidebar-box {
  position: relative;
  box-sizing: border-box;
  padding: 12px 14px;
  background: rgb(var(--shm-surface-rgb) / 0.92);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.3);
}

/*
 * A count on the box's top right corner, reaching a little over its edge, like apps show unread
 * messages (e.g. the notifications); also while the box is collapsed.
 */
.shm-sidebar-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 1;
  box-sizing: border-box;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  color: #fff;
  font-size: calc(11px * var(--shm-font-scale));
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  background: var(--shm-danger);
  border-radius: var(--shm-radius-pill);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
  pointer-events: none;
}

/* While a box is dragged, the places of the boxes show as the sidebar's grid. */
.shm-sidebar-slot {
  position: relative;
}

.shm-sidebar.is-sorting .shm-sidebar-slot {
  background: rgb(var(--shm-accent-rgb) / 0.06);
  outline: 1px dashed rgb(var(--shm-accent-rgb) / 0.45);
}

.shm-sidebar.is-sorting,
.shm-sidebar.is-sorting .shm-sidebar-handle {
  cursor: grabbing;
  user-select: none;
}

/* The dragged box follows the pointer above the others (its transform is set while dragging). */
.shm-sidebar-box.is-dragging {
  position: relative;
  z-index: 1;
  box-shadow: 0 12px 30px rgb(0 0 0 / 0.45);
}

.shm-sidebar-toggle .shm-icon {
  transition: transform 0.2s ease;
}

.shm-sidebar-box.is-collapsed .shm-sidebar-toggle .shm-icon {
  transform: rotate(180deg);
}

/* Collapsing animates the height: the body's only grid row shrinks from its content to nothing. */
.shm-sidebar-box-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.2s ease;
}

.shm-sidebar-box.is-collapsed .shm-sidebar-box-body {
  grid-template-rows: 0fr;
}

.shm-sidebar-box-content {
  min-height: 0;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .shm-sidebar-toggle .shm-icon,
  .shm-sidebar-box-body {
    transition: none;
  }
}

.shm-sidebar-box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.shm-sidebar-handle {
  display: inline-flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.shm-sidebar-handle:active {
  cursor: grabbing;
}

.shm-sidebar-handle .shm-icon {
  color: var(--shm-text-faint);
}

.shm-sidebar-handle:focus-visible {
  outline: 1px solid var(--shm-accent);
  outline-offset: 2px;
}

.shm-sidebar-title {
  color: var(--shm-accent);
  font-size: calc(11px * var(--shm-font-scale));
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-sidebar-icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--shm-text-muted);
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-sidebar-icon-button:hover,
.shm-sidebar-icon-button:focus-visible {
  color: var(--shm-text-strong);
  outline: none;
}

.shm-sidebar-figures {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 10px 0 0;
}

.shm-sidebar-figures > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.shm-sidebar-figures dt {
  color: var(--shm-text-muted);
}

.shm-sidebar-figures dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.shm-sidebar-figures dd.is-discount {
  color: var(--shm-success);
}

/* CCUs without base ship in the CCU Consultant's box (#115). */
.shm-sidebar-figures dd.is-warning {
  color: var(--shm-danger);
}

/* Every CCU can be applied: the CCU Consultant's box says so briefly. */
.shm-sidebar-ok {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-sidebar-ok .shm-icon {
  flex: none;
  color: var(--shm-success);
}

.shm-sidebar-note {
  margin: 8px 0 0;
  color: var(--shm-text-muted);
  font-size: calc(11px * var(--shm-font-scale));
}

/*
 * Each notification in a light frame of its own, so several stand apart (Modern Hangar: a filled
 * cell, see modern.css).
 */
.shm-sidebar-melt-ready,
.shm-sidebar-notes > li {
  padding: 8px;
  background: rgb(var(--shm-accent-rgb) / 0.06);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.18);
}

/*
 * Space below the title like the other boxes' figures (10 px), a little more for the frames, so the
 * first notification doesn't sit right under it. The list's margins need the weight of an ID
 * (`:not(#shm-none)`): RSI's `#billing .content ul { margin: 0 }` resets every list on the page.
 */
.shm-sidebar-box-content > .shm-sidebar-melt-ready:first-child,
.shm-sidebar-box-content > .shm-sidebar-notes:first-child:not(#shm-none) {
  margin-top: 12px;
}

/*
 * The notifications worked out from the current state – marked pledges that can be melted now,
 * paints to buy again (#151) – each one for all of its pledges, laid out like the others – an
 * icon in place of the checkbox (it can't be checked off) and the text, then its actions as buttons
 * like those of the Paint Discount box (`.shm-sidebar-actions`). Side by side they take the full
 * width, so they fit more often (measured on RSI's page: English in Modern Hangar); stacked, they
 * are indented like the text above them (`is-wrapped`, see `v-mark-wrapped`).
 */
.shm-sidebar-melt-ready {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  column-gap: 8px;
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-sidebar-melt-ready > .shm-icon {
  margin-top: 2px;
  color: var(--shm-text-secondary);
}

.shm-sidebar-melt-ready p {
  margin: 0;
}

/* A note's title on a line of its own, e.g. the account's risk (#330). */
.shm-sidebar-melt-ready p strong {
  display: block;
  margin-bottom: 2px;
}

/* A link in a note's text, in the accent of the theme (not RSI's link color). */
.shm-sidebar-melt-ready p a {
  color: var(--shm-accent);
  text-decoration: none;
}

.shm-sidebar-melt-ready p a:hover,
.shm-sidebar-melt-ready p a:focus-visible {
  text-decoration: underline;
}

.shm-sidebar-melt-ready .shm-sidebar-actions {
  grid-column: 1 / -1;
  margin-top: 8px;
}

/*
 * A note below the actions, e.g. the consultant's filler paints among the pledges (#105): under
 * the text, not in the icon's column, which it would widen and squeeze the text.
 */
.shm-sidebar-melt-ready > .shm-sidebar-note {
  grid-column: 2;
}

.shm-sidebar-melt-ready .shm-sidebar-actions.is-wrapped {
  grid-column: 2;
}

/* A watchlist's reminder (#469): its description below the text, at most three lines. */
.shm-sidebar-melt-ready > .shm-sidebar-reminder-text {
  display: -webkit-box;
  margin: 4px 0 0;
  overflow: hidden;
  color: var(--shm-text-secondary);
  white-space: pre-line;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.shm-sidebar-melt-ready > .shm-sidebar-note.is-error {
  color: var(--shm-danger);
}

/* Ship removals (#290): the icon in the color of the highest level, each warning in its own. */
.shm-sidebar-removal.is-warning > .shm-icon,
.shm-sidebar-removal-warnings .is-warning .shm-icon {
  color: var(--shm-warning);
}

.shm-sidebar-removal.is-critical > .shm-icon,
.shm-sidebar-removal-warnings .is-critical .shm-icon {
  color: var(--shm-danger);
}

/* Below the text, in its column; RSI's page resets every list (see the notes' list). */
.shm-sidebar-removal-warnings:not(#shm-none) {
  display: grid;
  grid-column: 2;
  gap: 4px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

/* Its own line height and margins: RSI's page sets those of every list item. */
.shm-sidebar-removal-warnings li {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin: 0;
  color: var(--shm-text-secondary);
  font-size: calc(11px * var(--shm-font-scale));
  line-height: 1.35;
}

.shm-sidebar-removal-warnings .shm-icon {
  flex: none;
}

/* On sale now, but not always available (#293): below the ships, in the text's column. */
.shm-sidebar-melt-ready > .shm-sidebar-removal-limited {
  margin: 6px 0 0;
  color: var(--shm-text-secondary);
}

/* A ship without CCUs from it: no icon, its name in line with the warned ships' names. */
.shm-sidebar-removal-warnings li.is-plain {
  padding-left: calc(1em + 6px);
}

/* Between the notifications as within their list (`gap`); for the list, see the title's space. */
.shm-sidebar-melt-ready + .shm-sidebar-melt-ready,
.shm-sidebar-melt-ready + .shm-sidebar-notes:not(#shm-none) {
  margin-top: 8px;
}

/* With an X in its top right corner that dismisses it; the text keeps clear of it. */
.shm-sidebar-melt-ready.is-dismissable {
  position: relative;
}

.shm-sidebar-melt-ready.is-dismissable p {
  padding-right: 16px;
}

.shm-sidebar-note-dismiss {
  position: absolute;
  top: 2px;
  right: 2px;
}

/* Notifications (#142): each with an × to check it off (#164), newest first. */
.shm-sidebar-notes,
.shm-sidebar-pending {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * The sidebar sits in RSI's navigation, whose `.sidenav li` has a fixed height of 35 px and a
 * margin: the lists here take the height of their text. One class more than RSI's rule, whose
 * stylesheet comes later.
 */
.shm-sidebar-box-content .shm-sidebar-notes li,
.shm-sidebar-box-content .shm-sidebar-pending li {
  height: auto;
  margin-bottom: 0;
}

.shm-sidebar-notes > li {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

/* Their text keeps clear of the × in the top right corner. */
.shm-sidebar-notes > li > .shm-sidebar-note-text {
  padding-right: 16px;
}

/* The list of changed Pledge Store items, opened from its summary. */
.shm-sidebar-note-details {
  margin-top: 4px;
  font-size: calc(11px * var(--shm-font-scale));
}

.shm-sidebar-note-details summary {
  color: var(--shm-accent);
  cursor: pointer;
}

.shm-sidebar-note-details ul {
  margin: 4px 0 0;
  padding-left: 16px;
  color: var(--shm-text-secondary);
}

.shm-sidebar-note-link {
  display: block;
  margin-top: 4px;
  padding: 0;
  text-align: left;
}

.shm-sidebar-note-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--shm-text);
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-sidebar-note-text a {
  color: inherit;
  text-decoration: none;
}

.shm-sidebar-note-text a:hover,
.shm-sidebar-note-text a:focus-visible {
  color: var(--shm-accent);
  text-decoration: underline;
}

.shm-sidebar-note-text .shm-sidebar-note {
  margin: 2px 0 0;
}

.shm-sidebar-subtitle {
  margin: 14px 0 6px;
  color: var(--shm-text-secondary);
  font-size: calc(11px * var(--shm-font-scale));
  text-transform: uppercase;
}

.shm-sidebar-pending li {
  display: flex;
  flex-direction: column;
  font-size: calc(12px * var(--shm-font-scale));
}

.shm-sidebar-pending .shm-sidebar-note {
  margin: 0;
}

.shm-sidebar-pending-title {
  overflow: hidden;
  color: var(--shm-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * The buttons below a box's figures (the manager's buttons, see row.css and modern.css): side by
 * side, sharing the width; each takes a line of its own when the box is too narrow for both.
 */
.shm-sidebar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.shm-sidebar-button {
  flex: 1 1 auto;
  white-space: nowrap;
}

/* A single button of its own, e.g. bulk melting: the whole width, its label may wrap. */
.shm-sidebar-button.is-full {
  flex-basis: 100%;
  white-space: normal;
}

/* A switch that is on (the consultant's filter): filled, so it reads as pressed. */
.shm-sidebar-button[aria-pressed='true'] {
  color: var(--shm-text-strong);
  background: rgb(var(--shm-accent-rgb) / 0.32);
  border-color: var(--shm-accent);
}

/* A link-like button below a box's figures, e.g. to the Paint Discount Consultant. */
.shm-sidebar-link {
  display: inline-block;
  margin-top: 8px;
  padding: 0;
  color: var(--shm-accent);
  font: inherit;
  font-size: calc(12px * var(--shm-font-scale));
  background: none;
  border: 0;
  cursor: pointer;
}

.shm-sidebar-link:hover,
.shm-sidebar-link:focus-visible {
  color: var(--shm-text-strong);
  text-decoration: underline;
  outline: none;
}

.shm-sidebar-note.is-warning {
  color: var(--shm-warning);
}

/* Only for screen readers. */
.shm-sidebar-status {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>

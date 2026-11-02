import { managerSearchUrl, type ManagerTab } from '@/hangar/route';
import { i18n, type MessageKey } from '@/i18n';

/*
 * CCU Game (ccugame.app) shows a link to the RSI page of a pledge in the item details (Ships,
 * CCUs, Paints, Equipment, Other). Next to it, the extension adds a link that opens the pledge in
 * the Hangar Manager – for hangar items in the "My Hangar" tab, for buy back items (CCU Game's
 * "buyback" filter) in the "Buy Back" tab. CCU Game is an Angular app that re-renders the details
 * (e.g. when paging through grouped CCUs), so the links are kept in sync instead of added once.
 */

/** Marks the rows added by the extension. */
const MANAGER_ROW_ATTRIBUTE = 'data-shm-manager-link';
/** How many rows below the RSI link "Add to cart on RSI" is looked for. */
const MAX_ROWS_TO_CART = 4;

/** A kind of RSI link in CCU Game's details and where the manager link goes for it. */
interface LinkKind {
  /** Matches the RSI target – URL-encoded in the `jumpto` parameter, so tested after decoding. */
  target: RegExp;
  tab: ManagerTab;
  text: MessageKey;
  /** Row before which the manager link goes; without one it goes right after the RSI link. */
  insertBefore?: (rsiRow: Element) => Element | undefined;
}

const LINK_KINDS: LinkKind[] = [
  // Hangar item: `…/connect?jumpto=…/account/pledges?page=59`
  { target: /\/account\/pledges\?page=\d+/, tab: 'hangar', text: 'ccugame.openInManager' },
  // Buy back item: `…/connect?jumpto=…/account/buy-back-pledges?pagesize=1&page=657`. A few rows
  // below (paints have an "In Store" row in between) follows "Add to cart on RSI" – the manager
  // link goes right before that button.
  {
    target: /\/account\/buy-back-pledges\?/,
    tab: 'buyback',
    text: 'ccugame.openInManagerBuyback',
    insertBefore: (rsiRow) => {
      let row = rsiRow.nextElementSibling;
      for (let step = 0; row && step < MAX_ROWS_TO_CART; step++, row = row.nextElementSibling) {
        if (
          !row.hasAttribute(MANAGER_ROW_ATTRIBUTE) &&
          /add to cart/i.test(row.textContent ?? '')
        ) {
          return row;
        }
      }
      return undefined;
    },
  },
];

/** How far up from the RSI link the pledge id is looked for (the details panel). */
const MAX_PANEL_DEPTH = 8;

function kindOf(link: HTMLAnchorElement): LinkKind | undefined {
  const href = link.getAttribute('href') ?? '';
  let decoded = href;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    // Keep the raw href.
  }
  return LINK_KINDS.find((kind) => kind.target.test(decoded));
}

/** Pledge id shown in the same details panel as the link ("#62492122"). */
export function findPledgeId(link: Element): number | undefined {
  let panel: Element | null = link.parentElement;
  for (let depth = 0; panel && depth < MAX_PANEL_DEPTH; depth++, panel = panel.parentElement) {
    for (const element of panel.querySelectorAll('.mat-tooltip-trigger')) {
      const match = /^#(\d+)$/.exec(element.textContent?.trim() ?? '');
      if (match) return Number(match[1]);
    }
  }
  return undefined;
}

/**
 * Adds or updates the Hangar Manager link for every RSI link. The row is a copy of CCU Game's
 * link row (icon and styling stay the same) with the link replaced.
 */
export function syncManagerLinks(root: ParentNode): void {
  for (const rsiLink of root.querySelectorAll<HTMLAnchorElement>('a[href*="pledges"]')) {
    const kind = kindOf(rsiLink);
    const rsiRow = rsiLink.parentElement;
    if (!kind || !rsiRow || rsiRow.hasAttribute(MANAGER_ROW_ATTRIBUTE)) continue;
    const pledgeId = findPledgeId(rsiLink);
    const beforeRow = kind.insertBefore?.(rsiRow);

    // One manager row per RSI link: reuse an existing one and move it if the rows around changed
    // (e.g. "Add to cart on RSI" rendered later than the link).
    let managerRow = rsiRow.parentElement?.querySelector(`:scope > [${MANAGER_ROW_ATTRIBUTE}]`);
    if (!managerRow) {
      if (pledgeId === undefined) continue;
      managerRow = rsiRow.cloneNode(true) as Element;
      managerRow.setAttribute(MANAGER_ROW_ATTRIBUTE, '');
    }
    if (beforeRow) {
      if (beforeRow.previousElementSibling !== managerRow) beforeRow.before(managerRow);
    } else if (rsiRow.nextElementSibling !== managerRow) {
      rsiRow.after(managerRow);
    }
    if (pledgeId === undefined) {
      managerRow.remove();
      continue;
    }

    const link = managerRow.querySelector('a')!;
    const href = managerSearchUrl(pledgeId, kind.tab);
    const text = i18n.t(kind.text, [pledgeId]);
    // Only touched when something changed, so the observer doesn't trigger itself endlessly.
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    if (link.textContent !== text) link.textContent = text;
    link.target = '_blank';
    link.rel = 'noopener';
  }
}

/**
 * Keeps the links in sync while CCU Game re-renders. Changes are handled at most once per frame.
 * Returns a function that stops observing.
 */
export function watchManagerLinks(root: HTMLElement): () => void {
  let scheduled = false;
  const run = () => {
    scheduled = false;
    syncManagerLinks(root);
  };
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  });
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  run();
  return () => observer.disconnect();
}

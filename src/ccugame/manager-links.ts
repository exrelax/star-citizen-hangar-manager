import { i18n } from '@/i18n';
import { managerSearchUrl } from '@/hangar/route';

/*
 * CCU Game (ccugame.app) shows a link to the RSI hangar page of a pledge in the item details
 * (Ships, CCUs, Paints, Equipment, Other). Below it, a second link opens the pledge in the
 * Hangar Manager. CCU Game is an Angular app that re-renders the details (e.g. when paging
 * through grouped CCUs), so the links are kept in sync instead of added once.
 */

/**
 * CCU Game's own link to the RSI hangar page, e.g. `…/connect?jumpto=…/account/pledges?page=59` –
 * with the target URL-encoded in the `jumpto` parameter, so it is matched after decoding.
 */
const RSI_HANGAR_PAGE = /\/account\/pledges\?page=\d+/;

function isRsiHangarLink(link: HTMLAnchorElement): boolean {
  const href = link.getAttribute('href') ?? '';
  try {
    return RSI_HANGAR_PAGE.test(decodeURIComponent(href));
  } catch {
    return RSI_HANGAR_PAGE.test(href);
  }
}
/** Marks the rows added by the extension. */
const MANAGER_ROW_ATTRIBUTE = 'data-shm-manager-link';
/** How far up from the RSI link the pledge id is looked for (the details panel). */
const MAX_PANEL_DEPTH = 8;

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
 * Adds or updates the Hangar Manager link below every RSI hangar link. The row is a copy of CCU
 * Game's row (icon and styling stay the same) with the link replaced.
 */
export function syncManagerLinks(root: ParentNode): void {
  for (const rsiLink of root.querySelectorAll<HTMLAnchorElement>('a[href*="pledges"]')) {
    if (!isRsiHangarLink(rsiLink)) continue;
    const rsiRow = rsiLink.parentElement;
    if (!rsiRow || rsiRow.hasAttribute(MANAGER_ROW_ATTRIBUTE)) continue;
    const pledgeId = findPledgeId(rsiLink);

    let managerRow = rsiRow.nextElementSibling;
    if (!managerRow?.hasAttribute(MANAGER_ROW_ATTRIBUTE)) {
      if (pledgeId === undefined) continue;
      managerRow = rsiRow.cloneNode(true) as Element;
      managerRow.setAttribute(MANAGER_ROW_ATTRIBUTE, '');
      rsiRow.after(managerRow);
    }
    if (pledgeId === undefined) {
      managerRow.remove();
      continue;
    }

    const link = managerRow.querySelector('a')!;
    const href = managerSearchUrl(pledgeId);
    const text = i18n.t('ccugame.openInManager', [pledgeId]);
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

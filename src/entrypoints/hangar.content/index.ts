import { i18n, locale } from '@/i18n';
import { followLanguageSetting } from '@/settings/language';
import { createApp, watch } from 'vue';
import { createNavItem, findAccountNav, findHangarLink, setActiveItem } from '@/hangar/account-nav';
import { BUYBACK_LIST, revealPledge } from '@/hangar/highlight';
import {
  highlightFromUrl,
  isBuybackPath,
  isHangarPath,
  isManagerRoute,
  MANAGER_HASH,
  managerHref,
} from '@/hangar/route';
import {
  applyManagerAction,
  isManagerActionMessage,
  takeActionFromUrl,
} from '@/hangar/manager-action';
import { isTimerActive, startSmartUpdateTimer } from '@/hangar/smart-update/schedule';
import { listenForChecksElsewhere } from '@/hangar/smart-update/broadcast';
import { resetBackoff, watchInput } from '@/hangar/smart-update/backoff';
import { takeOwnAction, watchOwnActions } from '@/hangar/smart-update/own-actions';
import { maybeRunSmartUpdate, setCheckingElsewhere } from '@/hangar/sync-state';
import { migrateStorage } from '@/storage/migrate';
import { isPlainLeftClick } from '@/shared/dom';
import { MANAGER_CONTAINER } from '@/themes/theme';
import App from './App.vue';
import './page.css';

/** Class on <html> while the manager view is shown, for page-level styles (see page.css). */
const ACTIVE_CLASS = 'shm-manager-active';

export default defineContentScript({
  matches: ['https://robertsspaceindustries.com/*'],

  async main(ctx) {
    const nav = findAccountNav(document);
    const hangarLink = nav && findHangarLink(nav);
    if (!nav || !hangarLink) return;

    // Data of earlier versions moves to its current keys before anything reads it.
    await migrateStorage();
    // Applied before anything is rendered, so the nav entry and view start in the right language.
    ctx.onInvalidated(await followLanguageSetting());

    // The manager view lives on the original hangar page (`…/account/pledges#hangar-manager`),
    // so the site keeps rendering its layout and navigation around it.
    const navItem = createNavItem(
      document,
      managerHref(hangarLink.getAttribute('href') ?? ''),
      i18n.t('nav.manager'),
    );
    nav.prepend(navItem);
    ctx.onInvalidated(
      watch(locale, () => {
        navItem.querySelector('.bg')!.textContent = i18n.t('nav.manager');
      }),
    );

    // An exchange, gift or applied upgrade confirmed in RSI's dialogs (#124): a check right after
    // it, whatever the interval; also when RSI reloaded the page after it.
    const checkOwnAction = () =>
      void resetBackoff().then(() => maybeRunSmartUpdate({ force: true }));
    if (await takeOwnAction()) checkOwnAction();
    watchOwnActions(ctx.signal, checkOwnAction);
    // Someone uses the tab: back to the set interval (#125).
    watchInput(ctx.signal);

    // "Buy Back Pledges": melting or buying back may start here, maybe without the manager ever
    // being opened in this tab. A check when one is due; the tabs with the manager follow.
    if (isBuybackPath(location.pathname)) {
      void maybeRunSmartUpdate();
      // Opened via "Show in Buy Back" from the manager: scroll to the pledge and highlight it.
      const buybackHighlight = highlightFromUrl(location.search);
      if (buybackHighlight) void revealPledge(buybackHighlight, BUYBACK_LIST);
      return;
    }

    const originalContent = document.querySelector<HTMLElement>('.inner-content');
    if (!isHangarPath(location.pathname) || !originalContent) return;

    // Opened via "Show in My Gear" from the manager: scroll to the pledge and highlight it.
    const highlightId = highlightFromUrl(location.search);
    if (highlightId && !isManagerRoute(location.hash)) void revealPledge(highlightId);

    const originalActiveItem = nav.querySelector<HTMLLIElement>(':scope > li.active');
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: originalContent,
      append: 'after',
      onMount(container) {
        // Takes the place of the original content area, including its layout styles.
        container.classList.add('inner-content', 'shm-manager');
        const app = createApp(App);
        // The theme (a setting) is applied to the container: see App.vue and src/themes.
        app.provide(MANAGER_CONTAINER, container);
        app.mount(container);
        return app;
      },
      onRemove(app) {
        app?.unmount();
      },
    });

    // A check running in another tab shows here as "Checking …" too.
    ctx.onInvalidated(listenForChecksElsewhere(setCheckingElsewhere));

    let managerVisible = false;
    let initialRender = true;
    const render = () => {
      const showManager = isManagerRoute(location.hash);
      const firstRender = initialRender;
      initialRender = false;
      // "My Gear": melting, gifting and exchanging happen here. A check when one is due (paging
      // through it doesn't check on every page); the tabs with the manager follow.
      if (!showManager && (firstRender || managerVisible)) void maybeRunSmartUpdate();
      if (showManager === managerVisible) return;
      managerVisible = showManager;

      originalContent.style.display = showManager ? 'none' : '';
      document.documentElement.classList.toggle(ACTIVE_CLASS, showManager);
      setActiveItem(nav, showManager ? navItem : originalActiveItem);
      if (showManager) ui.mount();
      else ui.remove();

      // Coming back from "My Gear", pledges may just have been melted or gifted: check right away.
      if (showManager) void maybeRunSmartUpdate({ force: !firstRender });
    };

    // The nav links point to `/account/pledges` without the locale prefix, so following them
    // would reload the page (plus a redirect). Both views live on the current document, so a
    // plain click only updates the URL via the History API.
    const switchView = (showManager: boolean) => (event: MouseEvent) => {
      if (!isPlainLeftClick(event)) return;
      event.preventDefault();
      const url = location.pathname + location.search + (showManager ? MANAGER_HASH : '');
      if (url !== location.pathname + location.search + location.hash) {
        history.pushState(null, '', url);
      }
      render();
    };
    // `ctx.signal` detaches the listeners when the extension is reloaded or updated.
    navItem.querySelector('a')!.addEventListener('click', switchView(true), { signal: ctx.signal });
    hangarLink.addEventListener('click', switchView(false), { signal: ctx.signal });

    ctx.onInvalidated(() => document.documentElement.classList.remove(ACTIVE_CLASS));

    // Back/forward and manual hash edits.
    ctx.addEventListener(window, 'popstate', render);
    ctx.addEventListener(window, 'hashchange', render);
    ctx.addEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible' && managerVisible) void maybeRunSmartUpdate();
    });
    // While it stays open and visible: a check whenever the interval has passed.
    const timerActive = () =>
      isTimerActive({
        managerShown: managerVisible,
        hidden: document.visibilityState === 'hidden',
      });
    startSmartUpdateTimer(ctx.signal, timerActive, () => maybeRunSmartUpdate());
    render();

    // A click on a browser notification (#154): in this tab as a message, in a tab opened for it
    // as a URL parameter, read once.
    const pendingAction = takeActionFromUrl();
    if (pendingAction) void applyManagerAction(pendingAction);
    const onAction = (message: unknown) => {
      if (!isManagerActionMessage(message)) return undefined;
      void applyManagerAction(message.action);
      // Tells the background script that this tab took it.
      return Promise.resolve(true);
    };
    browser.runtime.onMessage.addListener(onAction);
    ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(onAction));
  },
});

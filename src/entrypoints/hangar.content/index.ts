import { i18n } from '#i18n';
import { createApp } from 'vue';
import { createNavItem, findAccountNav, findHangarLink, setActiveItem } from '@/hangar/account-nav';
import { isHangarPath, isManagerRoute, MANAGER_HASH, managerHref } from '@/hangar/route';
import { isPlainLeftClick } from '@/shared/dom';
import App from './App.vue';
import './page.css';

/** Class on <html> while the manager view is shown, for page-level styles (see page.css). */
const ACTIVE_CLASS = 'shm-manager-active';

export default defineContentScript({
  matches: ['https://robertsspaceindustries.com/*'],

  main(ctx) {
    const nav = findAccountNav(document);
    const hangarLink = nav && findHangarLink(nav);
    if (!nav || !hangarLink) return;

    // The manager view lives on the original hangar page (`…/account/pledges#hangar-manager`),
    // so the site keeps rendering its layout and navigation around it.
    const navItem = createNavItem(
      document,
      managerHref(hangarLink.getAttribute('href') ?? ''),
      i18n.t('nav.manager'),
    );
    nav.prepend(navItem);

    const originalContent = document.querySelector<HTMLElement>('.inner-content');
    if (!isHangarPath(location.pathname) || !originalContent) return;

    const originalActiveItem = nav.querySelector<HTMLLIElement>(':scope > li.active');
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: originalContent,
      append: 'after',
      onMount(container) {
        // Takes the place of the original content area, including its layout styles.
        container.classList.add('inner-content');
        const app = createApp(App);
        app.mount(container);
        return app;
      },
      onRemove(app) {
        app?.unmount();
      },
    });

    let managerVisible = false;
    const render = () => {
      const showManager = isManagerRoute(location.hash);
      if (showManager === managerVisible) return;
      managerVisible = showManager;

      originalContent.style.display = showManager ? 'none' : '';
      document.documentElement.classList.toggle(ACTIVE_CLASS, showManager);
      setActiveItem(nav, showManager ? navItem : originalActiveItem);
      if (showManager) ui.mount();
      else ui.remove();
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
    render();
  },
});

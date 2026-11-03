import type { Theme } from '@/settings/settings';
import { watchEffect, type InjectionKey, type Ref } from 'vue';
import './tokens.css';
import './modern.css';

/** CSS class of a theme, on the manager's container and on its overlays. */
export const themeClass = (theme: Theme) => `shm-theme-${theme}`;

/** The element the manager is mounted into (provided by the content script). */
export const MANAGER_CONTAINER: InjectionKey<HTMLElement> = Symbol('shm-manager-container');

/** Keeps the theme class of `element` in line with the setting. */
export function useThemeClass(element: HTMLElement | undefined, theme: Readonly<Ref<Theme>>) {
  watchEffect(() => {
    if (!element) return;
    for (const name of [...element.classList]) {
      if (name.startsWith('shm-theme-')) element.classList.remove(name);
    }
    element.classList.add(themeClass(theme.value));
  });
}

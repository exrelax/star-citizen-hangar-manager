import { FONT_SIZE_SCALES } from '@/config';
import type { Settings, Theme } from '@/settings/settings';
import { watchEffect, type InjectionKey, type Ref } from 'vue';
import './tokens.css';
import './modern.css';

/** CSS class of a theme, on the manager's container and on its overlays. */
export const themeClass = (theme: Theme) => `shm-theme-${theme}`;

/** The text size setting as a factor on all font sizes (see `--shm-font-scale`). */
export function fontScale(settings: Settings) {
  return FONT_SIZE_SCALES[settings.fontSize];
}

/** Inline style that sets the text size on an element and all inside it. */
export const fontScaleStyle = (settings: Settings) => ({
  '--shm-font-scale': String(fontScale(settings)),
});

/** Classes of the selected theme and the display options: the theme class, `shm-compact`. */
export function themeClasses(settings: Settings) {
  const classes = [themeClass(settings.theme)];
  if (settings.compactView) classes.push('shm-compact');
  return classes;
}

/** The element the manager is mounted into (provided by the content script). */
export const MANAGER_CONTAINER: InjectionKey<HTMLElement> = Symbol('shm-manager-container');

/** Keeps the theme classes and text size of `element` in line with the settings. */
export function useThemeClass(element: HTMLElement | undefined, settings: Readonly<Ref<Settings>>) {
  watchEffect(() => {
    if (!element) return;
    for (const name of [...element.classList]) {
      if (name.startsWith('shm-theme-') || name === 'shm-compact') element.classList.remove(name);
    }
    element.classList.add(...themeClasses(settings.value));
    element.style.setProperty('--shm-font-scale', String(fontScale(settings.value)));
  });
}

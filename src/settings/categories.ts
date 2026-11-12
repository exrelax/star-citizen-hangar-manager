import type { MessageKey } from '@/i18n';
import type { IconName } from '@/icons/icon-names';
import { ref } from 'vue';

/*
 * The categories of the settings tab (#117): a list on the left, one category at a time on the
 * right. In the order of the list, in groups by what they are about.
 */

export const SETTINGS_CATEGORIES = [
  'appearance',
  'privacy',
  'demo',
  'lists',
  'filters',
  'sidebar',
  'notifications',
  'paintConsultant',
  'smartUpdates',
  'experimental',
  'storage',
  'about',
  'development',
] as const;
export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

export interface CategoryInfo {
  title: MessageKey;
  icon: IconName;
}

export const CATEGORY_INFO: Record<SettingsCategory, CategoryInfo> = {
  appearance: { title: 'settings.appearance', icon: 'palette' },
  privacy: { title: 'settings.privacyTitle', icon: 'eye-slash' },
  demo: { title: 'settings.demo.title', icon: 'wand-magic-sparkles' },
  lists: { title: 'settings.lists', icon: 'list' },
  filters: { title: 'settings.filters', icon: 'filter' },
  sidebar: { title: 'settings.sidebar', icon: 'table-columns' },
  notifications: { title: 'notifications.title', icon: 'bell' },
  paintConsultant: { title: 'settings.paintConsultant', icon: 'fill-drip' },
  smartUpdates: { title: 'settings.smartUpdates', icon: 'rotate' },
  experimental: { title: 'settings.experimental', icon: 'flask' },
  storage: { title: 'storage.title', icon: 'database' },
  about: { title: 'settings.about', icon: 'circle-info' },
  development: { title: 'settings.development', icon: 'code' },
};

/** The groups of the list, each with a title above its categories. */
export const CATEGORY_GROUPS: { title: MessageKey; categories: SettingsCategory[] }[] = [
  { title: 'settings.categoryGroups.general', categories: ['appearance', 'privacy', 'demo'] },
  { title: 'settings.categoryGroups.lists', categories: ['lists', 'filters', 'sidebar'] },
  {
    title: 'settings.categoryGroups.automation',
    categories: ['notifications', 'paintConsultant', 'smartUpdates'],
  },
  {
    title: 'settings.categoryGroups.more',
    categories: ['experimental', 'storage', 'about', 'development'],
  },
];

/** The element id of a category's panel, e.g. for a link to it (`anchors.ts`). */
export const categoryElementId = (category: SettingsCategory) => `shm-settings-${category}`;

/** The category shown; it stays while the manager switches tabs. */
export const currentCategory = ref<SettingsCategory>('appearance');

/**
 * Sent to a category's panel by `openTabAt` when it links to a setting inside it: the category
 * is shown first, so the setting can be scrolled to.
 */
export const REVEAL_EVENT = 'shm-reveal';

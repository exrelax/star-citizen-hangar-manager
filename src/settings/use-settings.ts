import { onMounted, onUnmounted, shallowRef } from 'vue';
import { DEFAULT_SETTINGS, settingsItem, withDefaults, type Settings } from './settings';

/** Current settings, kept up to date when they change (also from other tabs or devices). */
export function useSettings() {
  const settings = shallowRef<Settings>(DEFAULT_SETTINGS);

  const apply = (stored: Partial<Settings> | null) => {
    settings.value = withDefaults(stored);
  };

  const unwatch = settingsItem.watch(apply);
  onMounted(async () => apply(await settingsItem.getValue()));
  onUnmounted(unwatch);

  async function update(patch: Partial<Settings>) {
    const next = { ...settings.value, ...patch };
    settings.value = next;
    await settingsItem.setValue(next);
  }

  return { settings, update };
}

import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { DEFAULT_SETTINGS, settingsItem, withDefaults, type Settings } from './settings';

/** Current settings, kept up to date when they change (also from other tabs or devices). */
export function useSettings() {
  const settings = shallowRef<Settings>(DEFAULT_SETTINGS);
  /** Whether the stored settings are read; until then `settings` holds the defaults. */
  const loaded = ref(false);

  const apply = (stored: Partial<Settings> | null) => {
    settings.value = withDefaults(stored);
    loaded.value = true;
  };

  const unwatch = settingsItem.watch(apply);
  onMounted(async () => apply(await settingsItem.getValue()));
  onUnmounted(unwatch);

  async function update(patch: Partial<Settings>) {
    const next = { ...settings.value, ...patch };
    settings.value = next;
    await settingsItem.setValue(next);
  }

  return { settings, loaded, update };
}

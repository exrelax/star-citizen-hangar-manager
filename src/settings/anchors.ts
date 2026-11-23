import { categoryElementId } from './categories';

/*
 * Ids of settings that other parts of the manager link to (see `openTabAt`): the settings tab
 * opens scrolled to them.
 */

/** The experimental setting "Bulk melting", linked from the sidebar's "Selected" box (#159). */
export const BULK_MELTING_SETTING_ID = 'shm-setting-bulk-melting';

/** Its limit (#622), linked from the bulk melting button above it in the "Selected" box. */
export const BULK_MELTING_MAX_SETTING_ID = 'shm-setting-bulk-melting-max';

/** "Browser notifications", linked from the sidebar's hint about them (#152). */
export const BROWSER_NOTIFICATIONS_SETTING_ID = 'shm-setting-browser-notifications';

/** The category "Demo mode", linked from the "Demo" label next to the manager's title (#278). */
export const DEMO_SETTINGS_ID = categoryElementId('demo');

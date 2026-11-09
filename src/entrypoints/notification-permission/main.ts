import '@/shared/styles/ui.css';
import { followLanguageSetting } from '@/settings/language';
import { createApp } from 'vue';
import PermissionPage from './PermissionPage.vue';

// The language setting is applied first, so the page opens in the right language right away.
void followLanguageSetting().then(() => createApp(PermissionPage).mount('#app'));

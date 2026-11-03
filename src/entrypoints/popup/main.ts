import '@/shared/styles/ui.css';
import { followLanguageSetting } from '@/settings/language';
import { createApp } from 'vue';
import PopupMenu from './PopupMenu.vue';

// The language setting is applied first, so the popup opens in the right language right away.
void followLanguageSetting().then(() => createApp(PopupMenu).mount('#app'));

import '@/shared/styles/ui.css';
import { followLanguageSetting } from '@/settings/language';
import { createApp } from 'vue';
import StyleguidePage from './StyleguidePage.vue';

// The styleguide is built in development only (see wxt.config.ts).
void followLanguageSetting().then(() => createApp(StyleguidePage).mount('#app'));

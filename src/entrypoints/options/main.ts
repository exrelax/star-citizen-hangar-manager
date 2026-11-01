import '@/shared/styles/ui.css';
import { followLanguageSetting } from '@/settings/language';
import { createApp } from 'vue';
import App from './App.vue';

// The language setting is applied first, so the page renders in the right language right away.
void followLanguageSetting().then(() => createApp(App).mount('#app'));

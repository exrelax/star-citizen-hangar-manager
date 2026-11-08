<script setup lang="ts">
import BuybackList from '@/buyback/components/BuybackList.vue';
import PledgeList from '@/hangar/components/PledgeList.vue';
import { i18n } from '@/i18n';
import { ICON_NAMES } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import SettingsPanel from '@/settings/SettingsPanel.vue';
import { THEMES } from '@/settings/settings';
import TabBar from '@/shared/components/TabBar.vue';
import { useSettings } from '@/settings/use-settings';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
import { buybackFixtures, hangarFixtures } from './fixtures';

/*
 * The manager's building blocks on one page, for contributors: theme colors, icons, the real
 * lists with made-up pledges (filters, search, rows, their buttons and dialogs) and the settings.
 * Theme, language and the display options are the extension's own settings, so a change here
 * applies to the manager on RSI's page, too.
 */

const { settings, update } = useSettings();
const stage = useTemplateRef<HTMLElement>('stage');

const themeItems = computed(() =>
  THEMES.map((theme) => ({ id: theme, label: i18n.t(`settings.themeOptions.${theme}`) })),
);

/** The theme tokens (src/themes); the last group is used by "Modern Hangar" only. */
const COLOR_GROUPS = [
  {
    name: 'Text',
    tokens: ['text', 'text-strong', 'text-secondary', 'text-muted', 'text-faint', 'text-on-accent'],
  },
  {
    name: 'Accent and status',
    tokens: ['accent', 'success', 'warning', 'upgraded', 'danger'],
  },
  { name: 'Surfaces', tokens: ['surface-elevated', 'backdrop'] },
  {
    name: 'Modern Hangar only',
    tokens: ['background', 'fill', 'fill-strong', 'separator', 'segment', 'hover'],
  },
];

/** The resolved value of each token in the current theme and appearance. */
const resolved = ref<Record<string, string>>({});
function resolveTokens() {
  if (!stage.value) return;
  const style = getComputedStyle(stage.value);
  resolved.value = Object.fromEntries(
    COLOR_GROUPS.flatMap((group) => group.tokens).map((token) => [
      token,
      style.getPropertyValue(`--shm-${token}`).trim(),
    ]),
  );
}

// "Modern Hangar" follows the system appearance: the values change with it, too.
const appearance = matchMedia('(prefers-color-scheme: light)');
onMounted(() => {
  resolveTokens();
  appearance.addEventListener('change', resolveTokens);
});
onUnmounted(() => appearance.removeEventListener('change', resolveTokens));
watch(
  () => settings.value.theme,
  () => nextTick(resolveTokens),
);
</script>

<template>
  <div
    ref="stage"
    class="shm-styleguide shm-manager"
    :class="themeClasses(settings)"
    :style="fontScaleStyle(settings)"
  >
    <header class="shm-sg-header">
      <div>
        <h1 class="shm-sg-title">Styleguide</h1>
        <p class="shm-sg-intro">
          The Hangar Manager's building blocks with made-up pledges, in both themes: "Classic RSI"
          follows the layout of RSI's website, "Modern Hangar" Apple's Human Interface Guidelines.
          Theme, language and display options are the extension's settings: changing them here
          changes the manager, too.
        </p>
      </div>
      <!-- The manager's tab component, so the switch looks like the tabs of each theme. -->
      <TabBar
        class="shm-sg-themes"
        :items="themeItems"
        :selected="settings.theme"
        :label="i18n.t('settings.theme')"
        @select="(theme) => update({ theme })"
      />
    </header>

    <nav class="shm-sg-nav" aria-label="Sections">
      <a href="#colors">Colors</a>
      <a href="#icons">Icons</a>
      <a href="#hangar">My Hangar</a>
      <a href="#buyback">Buy Back</a>
      <a href="#settings">Settings</a>
    </nav>

    <section id="colors" class="shm-sg-section">
      <h2>Colors</h2>
      <p class="shm-sg-hint">
        CSS custom properties <code>--shm-…</code> of the current theme (src/themes). Use them in
        components, never literal colors.
      </p>
      <div v-for="group in COLOR_GROUPS" :key="group.name" class="shm-sg-colors">
        <h3>{{ group.name }}</h3>
        <ul>
          <li v-for="token in group.tokens" :key="token">
            <span class="shm-sg-swatch" :style="{ background: `var(--shm-${token})` }"></span>
            <code>--shm-{{ token }}</code>
            <span class="shm-sg-value">{{ resolved[token] || '–' }}</span>
          </li>
        </ul>
      </div>
    </section>

    <section id="icons" class="shm-sg-section">
      <h2>Icons</h2>
      <p class="shm-sg-hint">
        <code>&lt;SvgIcon name="…" /&gt;</code> – the sprite in src/assets/svg-sprites. Add an icon
        as an SVG there and run <code>pnpm svg-sprite</code>.
      </p>
      <ul class="shm-sg-icons">
        <li v-for="name in ICON_NAMES.fa" :key="name">
          <SvgIcon :name="name" />
          <code>{{ name }}</code>
        </li>
      </ul>
    </section>

    <section id="hangar" class="shm-sg-section">
      <h2>My Hangar</h2>
      <p class="shm-sg-hint">
        The real list with one pledge of each kind. Its buttons open the real dialogs; requests to
        RSI fail here (this page is not on RSI's website), so nothing can be exchanged or gifted.
      </p>
      <PledgeList :pledges="hangarFixtures" :settings="settings" :active="true" />
    </section>

    <section id="buyback" class="shm-sg-section">
      <h2>Buy Back</h2>
      <BuybackList :pledges="buybackFixtures" :settings="settings" :active="false" />
    </section>

    <section id="settings" class="shm-sg-section">
      <h2>Settings</h2>
      <SettingsPanel :settings="settings" @update="update" />
    </section>
  </div>
</template>

<style>
/* The page around the manager: RSI's dark blue, as on its website. */
html:has(.shm-styleguide) {
  background: #060e16;
}
</style>

<style scoped>
.shm-styleguide {
  box-sizing: border-box;
  max-width: 1040px;
  margin: 24px auto;
  padding: 28px;
  color: var(--shm-text);
  /* "Classic RSI" relies on RSI's page for its background; "Modern Hangar" sets its own. */
  background: rgb(var(--shm-surface-rgb) / 0.9);
}

.shm-sg-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.shm-sg-title {
  margin: 0;
  color: var(--shm-text);
  font-size: 28px;
}

.shm-sg-intro,
.shm-sg-hint {
  max-width: 68ch;
  margin: 6px 0 0;
  color: var(--shm-text-secondary);
  font-size: 13px;
}

/* In the header's corner: without the space above that the tabs have in the manager. */
.shm-styleguide .shm-sg-header .shm-sg-themes {
  flex: none;
  margin-top: 0;
}

.shm-sg-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgb(var(--shm-accent-rgb) / 0.2);
}

.shm-sg-nav a {
  color: var(--shm-accent);
  font-size: 13px;
  text-decoration: none;
}

.shm-sg-nav a:hover {
  text-decoration: underline;
}

.shm-sg-section {
  margin-top: 36px;
}

.shm-sg-section h2 {
  margin: 0;
  color: var(--shm-text);
  font-size: 20px;
}

.shm-sg-section code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.shm-sg-colors h3 {
  margin: 18px 0 8px;
  color: var(--shm-text-muted);
  font-size: 12px;
  font-weight: normal;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.shm-sg-colors ul,
.shm-sg-icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shm-sg-colors li {
  display: grid;
  grid-template-columns: 36px 1fr;
  column-gap: 10px;
  align-items: center;
}

.shm-sg-swatch {
  grid-row: span 2;
  width: 36px;
  height: 36px;
  /* Shows translucent fills and the backdrop over the same ground. */
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.25);
  border-radius: var(--shm-radius-item);
}

.shm-sg-value {
  color: var(--shm-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.shm-sg-icons {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  margin-top: 14px;
}

.shm-sg-icons li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--shm-text);
  font-size: 20px;
}

.shm-sg-icons code {
  color: var(--shm-text-secondary);
}
</style>

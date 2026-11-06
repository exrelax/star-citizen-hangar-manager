<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { useSettings } from '@/settings/use-settings';
import { fontScaleStyle, themeClasses } from '@/themes/theme';
import { computed, onUnmounted, ref, useId, useTemplateRef } from 'vue';
import type { Game } from '../pledge';

/*
 * The tag of a pledge that RSI protects as the game access (see `Pledge.protectedGames`), with a
 * tooltip that explains it. The rows clip what sticks out (`content-visibility`, rounded cards),
 * so the tooltip is teleported out of the manager and carries the theme classes itself, like the
 * dialogs.
 */
const props = defineProps<{
  games: readonly Game[];
  /**
   * Whether the pledge contains a ship: only then can a CCU still be applied (a reward like
   * "VIP High Admiral" has none).
   */
  hasShip: boolean;
}>();

const GAME_NAMES = { SC: 'Star Citizen', SQ42: 'Squadron 42' } as const;
/** e.g. "Star Citizen and Squadron 42", in the language of the manager. */
const gameList = computed(() =>
  new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(
    props.games.map((game) => GAME_NAMES[game]),
  ),
);

const { settings } = useSettings();
const id = `shm-tooltip-${useId()}`;
const badge = useTemplateRef('badge');
/** Where the tooltip shows (viewport coordinates), while it is open. */
const position = ref<{ top?: number; bottom?: number; left: number }>();

const WIDTH = 320;
const MARGIN = 8;
/** Room the tooltip needs below the tag; less than that and it opens above. */
const HEIGHT = 110;

function show() {
  const rect = badge.value?.getBoundingClientRect();
  if (!rect) return;
  const left = Math.max(MARGIN, Math.min(rect.left, innerWidth - WIDTH - MARGIN));
  position.value =
    rect.bottom + HEIGHT > innerHeight
      ? { bottom: innerHeight - rect.top + 6, left }
      : { top: rect.bottom + 6, left };
  // Fixed to the viewport: scrolling would move the tag away from it.
  addEventListener('scroll', hide, { capture: true, once: true });
}

function hide() {
  position.value = undefined;
  removeEventListener('scroll', hide, { capture: true });
}

onUnmounted(hide);
</script>

<template>
  <!-- Focusable, so the tooltip also opens from the keyboard. -->
  <span
    ref="badge"
    class="shm-badge is-protected"
    tabindex="0"
    :aria-describedby="id"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="hide"
    @keydown.esc="hide"
  >
    <SvgIcon name="lock" />{{ games.join(' · ') }}
  </span>
  <Teleport to="body">
    <span
      :id="id"
      role="tooltip"
      class="shm-tooltip"
      :class="themeClasses(settings)"
      :style="[
        fontScaleStyle(settings),
        position && {
          top: position.top === undefined ? undefined : `${position.top}px`,
          bottom: position.bottom === undefined ? undefined : `${position.bottom}px`,
          left: `${position.left}px`,
        },
      ]"
      :hidden="!position"
    >
      <strong>{{ i18n.t('pledge.protected') }}</strong>
      {{ i18n.t(hasShip ? 'pledge.protectedHint' : 'pledge.protectedHintNoShip', [gameList]) }}
    </span>
  </Teleport>
</template>

<style>
.shm-tooltip {
  position: fixed;
  z-index: 2147483000;
  box-sizing: border-box;
  display: block;
  width: min(320px, calc(100vw - 16px));
  padding: 10px 12px;
  color: var(--shm-text-secondary);
  font-size: calc(12px * var(--shm-font-scale));
  line-height: 1.45;
  background: var(--shm-surface-elevated);
  border: 1px solid rgb(var(--shm-accent-rgb) / 0.3);
  box-shadow: 0 12px 30px rgb(0 0 0 / 0.5);
  pointer-events: none;
}

.shm-tooltip[hidden] {
  display: none;
}

.shm-tooltip strong {
  display: block;
  margin-bottom: 2px;
  color: var(--shm-text-strong);
  font-weight: 600;
}

html .shm-tooltip.shm-theme-modern {
  border-radius: 10px;
}
</style>

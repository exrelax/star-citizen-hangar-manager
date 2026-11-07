<script setup lang="ts">
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import type { Game } from '../pledge';

/*
 * The tag of a pledge that RSI protects as the game access (see `Pledge.protectedGames`), with a
 * tooltip that explains it.
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

const tooltip = computed(() => ({
  title: i18n.t('pledge.protected'),
  text: i18n.t(props.hasShip ? 'pledge.protectedHint' : 'pledge.protectedHintNoShip', [
    gameList.value,
  ]),
}));
</script>

<template>
  <!-- Focusable, so the tooltip also opens from the keyboard. -->
  <span v-tooltip="tooltip" class="shm-badge is-protected" tabindex="0">
    <SvgIcon name="lock" />{{ games.join(' · ') }}
  </span>
</template>

<script setup lang="ts">
import type { IconName, IconSet } from './icon-names';
import { ensureSprite, symbolId } from './sprite';

/*
 * An icon of the sprites in `src/assets/svg-sprites` (see `sprite.ts`). It is as large as the
 * text (1em) and in its color; set `font-size` or `width`/`height` and `color` to change that.
 * Decorative by default; with `label` it is announced as an image.
 */
const props = withDefaults(defineProps<{ name: IconName; set?: IconSet; label?: string }>(), {
  set: 'fa',
  label: undefined,
});

ensureSprite(props.set);
</script>

<template>
  <svg
    class="shm-icon"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
  >
    <use :href="`#${symbolId(set, name)}`" />
  </svg>
</template>

<style>
.shm-icon {
  display: inline-block;
  flex: none;
  width: 1em;
  height: 1em;
  fill: currentColor;
  vertical-align: -0.125em;
}
</style>

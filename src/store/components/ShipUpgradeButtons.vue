<script setup lang="ts">
import { useDemoContext } from '@/demo/use-demo';
import { i18n } from '@/i18n';
import type { IconName } from '@/icons/icon-names';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { computed } from 'vue';
import { notifyShipUpgradeOpened } from '../ship-upgrade-opened';

/*
 * The buttons that open RSI's ship upgrade dialog with a ship as target, on the right of a row of
 * the Pledge Store tab: "Warbond upgrade" with the ship's warbond SKU (#392), left of it, as the
 * cheaper offer, and "Ship upgrade" with its standard SKU. Each shows only with its SKU. They use
 * RSI's own opener, a click handler on the page for `js-open-ship-upgrades`. In the demo they are
 * disabled: RSI's dialog shows the real account's ships and CCUs.
 *
 * Without a ship (My Hangar, #374) a single "Ship upgrade" opens the dialog without a preset base
 * or target ship, as the button of RSI's "My Gear" does.
 *
 * Rows ignore clicks inside `.shm-upgrade-buttons` for their toggle. An overlay that holds them
 * closes once RSI's dialog opens (#564, `ship-upgrade-opened.ts`), as it would hide the dialog.
 */

const props = defineProps<{
  /** The target ship; without one the dialog opens without a preset. */
  shipId?: number;
  shipName?: string;
  /** The standard SKU ("Ship upgrade"). */
  skuId?: number;
  /** The warbond SKU ("Warbond upgrade"). */
  warbondSkuId?: number;
  /** Short labels for a table (#385): "Warbond" and, next to it, "Standard". */
  short?: boolean;
  /** Only the icon, the label as its name, e.g. in a line of the CCU Check's secure panel (#651). */
  iconOnly?: boolean;
}>();

const demo = useDemoContext();

interface UpgradeButton {
  key: string;
  skuId?: number;
  icon: IconName;
  label: string;
  hint: string;
}

const buttons = computed(() => {
  if (props.shipId === undefined) {
    return [
      {
        key: 'any',
        icon: 'basket-shopping',
        label: i18n.t('store.openUpgrade'),
        hint: i18n.t('store.openUpgradeAnyHint'),
      } satisfies UpgradeButton,
    ];
  }
  const list: UpgradeButton[] = [];
  if (props.warbondSkuId !== undefined) {
    list.push({
      key: 'warbond',
      skuId: props.warbondSkuId,
      icon: 'tag',
      label: i18n.t(props.short ? 'store.openWarbondShort' : 'store.openWarbondUpgrade'),
      hint: i18n.t('store.openUpgradeHint', [props.shipName ?? '']),
    });
  }
  if (props.skuId !== undefined) {
    list.push({
      key: 'standard',
      skuId: props.skuId,
      icon: 'basket-shopping',
      label: i18n.t(
        props.short && props.warbondSkuId !== undefined
          ? 'store.openStandardShort'
          : 'store.openUpgrade',
      ),
      hint: i18n.t('ccusToSecure.openUpgradeHint', [props.shipName ?? '']),
    });
  }
  return list;
});
</script>

<template>
  <span v-if="buttons.length" class="shm-warbond-upgrade shm-upgrade-buttons">
    <template v-for="button in buttons" :key="button.key">
      <button
        v-if="demo"
        v-tooltip="i18n.t('store.upgradeDemo')"
        type="button"
        class="shm-button"
        :class="[`shm-upgrade-${button.key}`, { 'is-icon': iconOnly }]"
        :aria-label="iconOnly ? button.label : undefined"
        disabled
      >
        <SvgIcon :name="button.icon" />
        <template v-if="!iconOnly">{{ button.label }}</template>
      </button>
      <a
        v-else
        v-tooltip="button.hint"
        href="#"
        class="shm-button js-open-ship-upgrades"
        :class="[`shm-upgrade-${button.key}`, { 'is-icon': iconOnly }]"
        :aria-label="iconOnly ? `${button.label}: ${shipName ?? ''}` : undefined"
        data-apiurl="/pledge-store/api/upgrade/v2"
        :data-toshipid="shipId"
        :data-toskuid="button.skuId"
        @click.prevent="notifyShipUpgradeOpened"
      >
        <SvgIcon :name="button.icon" />
        <template v-if="!iconOnly">{{ button.label }}</template>
      </a>
    </template>
  </span>
</template>

<style scoped>
/* On the right, next to the chevron; on narrow rows the buttons wrap, each label on one line. */
.shm-upgrade-buttons {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.shm-upgrade-buttons .shm-button {
  white-space: nowrap;
}
</style>

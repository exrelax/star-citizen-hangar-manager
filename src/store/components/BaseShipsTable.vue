<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useShipFacts } from '@/ships/use-ship-facts';
import type { BuybackCcuGroup } from '@/price-increases/ccus-to-secure';
import type { BaseShip } from '../warbond';
// Shared, unscoped styles of the store's tables; a plain import, as `<style src>` of the same file
// in several components breaks the build.
import './store-table.css';

/**
 * The ships to start CCUs from, cheapest CCU first: the CCU's price, the ship and its standard
 * price, and how often the user already has the ship – as ship or as target of a CCU – in the
 * hangar and the buy back. For the warbond CCUs and the CCUs to secure before a price increase.
 * A check marks the ships that are always available in the Pledge Store (the website's ship facts,
 * #109), so the user can get onto them later to apply the CCU. Each ship opens RSI's ship upgrade
 * dialog with it as base and `target` as target, both chosen.
 *
 * With `buyback` (#311, a target RSI doesn't sell CCUs to right now): the buy back's CCUs to it
 * instead, by base ship – what buying one back costs (#185) and how many the buy back has. Nothing
 * opens RSI's upgrade dialog then.
 */
defineProps<{
  bases: readonly BaseShip[];
  /** The buy back's CCUs to the target, shown instead of `bases`. */
  buyback?: readonly BuybackCcuGroup[];
  /** The CCUs' target: the upgrade tool's ship and SKU (e.g. the warbond edition). */
  target: { shipId: number; skuId: number; name: string };
}>();

const shipFacts = useShipFacts();
const alwaysAvailable = (id: number) => shipFacts.value?.isAlwaysAvailable(id) === true;

const usd = (value: number) => formatUsd(value, locale.value);
/** Where a buy back price comes from (#185), as the buy back's rows say it. */
const priceHint = (group: BuybackCcuGroup) =>
  group.price ? i18n.t(`buyback.price.${group.price.source}`) : i18n.t('ccusToSecure.noPriceHint');
/** A count; nothing for none, so the counts that matter stand out. */
const count = (value: number) => (value ? String(value) : '–');
</script>

<template>
  <table v-if="buyback" class="shm-warbond-table">
    <thead>
      <tr>
        <th scope="col" class="is-number">{{ i18n.t('ccusToSecure.colBuybackPrice') }}</th>
        <th scope="col">{{ i18n.t('store.colFrom') }}</th>
        <th scope="col" class="is-number">{{ i18n.t('store.colShipPrice') }}</th>
        <th v-tooltip="i18n.t('store.colAlwaysAvailableHint')" scope="col" class="is-center">
          {{ i18n.t('store.colAlwaysAvailable') }}
        </th>
        <th scope="col" class="is-number is-group">{{ i18n.t('store.colBuybackCcus') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="group in buyback" :key="group.fromName">
        <td
          v-tooltip="priceHint(group)"
          class="is-number"
          :class="group.price ? 'is-strong' : 'is-none'"
        >
          {{ group.price ? usd(group.price.amount) : '–' }}
        </td>
        <td>{{ group.fromName }}</td>
        <td class="is-number" :class="{ 'is-none': !group.fromShip?.msrp }">
          {{ group.fromShip?.msrp ? usd(group.fromShip.msrp) : '–' }}
        </td>
        <td class="is-center">
          <SvgIcon
            v-if="group.fromShip && alwaysAvailable(group.fromShip.id)"
            name="check"
            class="shm-always-available"
            :label="i18n.t('store.colAlwaysAvailable')"
          />
        </td>
        <td class="is-number is-group">{{ group.count }}</td>
      </tr>
    </tbody>
  </table>
  <table v-else class="shm-warbond-table">
    <thead>
      <tr>
        <th scope="col" class="is-number">{{ i18n.t('store.colCcu') }}</th>
        <th scope="col">{{ i18n.t('store.colFrom') }}</th>
        <th scope="col" class="is-number">{{ i18n.t('store.colShipPrice') }}</th>
        <th v-tooltip="i18n.t('store.colAlwaysAvailableHint')" scope="col" class="is-center">
          {{ i18n.t('store.colAlwaysAvailable') }}
        </th>
        <th scope="col" class="is-number is-group">{{ i18n.t('store.colHangarShips') }}</th>
        <th scope="col" class="is-number">{{ i18n.t('store.colHangarCcus') }}</th>
        <th scope="col" class="is-number is-group">{{ i18n.t('store.colBuybackShips') }}</th>
        <th scope="col" class="is-number">{{ i18n.t('store.colBuybackCcus') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="base in bases" :key="base.ship.id">
        <td class="is-number is-strong">{{ usd(base.ccuPrice) }}</td>
        <td>
          <!-- RSI's own opener (a click handler on the page): its overlay with both ships chosen. -->
          <a
            v-tooltip="i18n.t('store.openUpgradeFromHint', [base.ship.name, target.name])"
            href="#"
            class="shm-base-ship-link js-open-ship-upgrades"
            data-apiurl="/pledge-store/api/upgrade/v2"
            :data-fromshipid="base.ship.id"
            :data-toshipid="target.shipId"
            :data-toskuid="target.skuId"
            @click.prevent
          >
            {{ base.ship.name }}
          </a>
        </td>
        <td class="is-number">{{ usd(base.ship.msrp) }}</td>
        <td class="is-center">
          <SvgIcon
            v-if="alwaysAvailable(base.ship.id)"
            name="check"
            class="shm-always-available"
            :label="i18n.t('store.colAlwaysAvailable')"
          />
        </td>
        <td class="is-number is-group" :class="{ 'is-none': !base.holdings.hangarShips }">
          {{ count(base.holdings.hangarShips) }}
        </td>
        <td class="is-number" :class="{ 'is-none': !base.holdings.hangarCcus }">
          {{ count(base.holdings.hangarCcus) }}
        </td>
        <td class="is-number is-group" :class="{ 'is-none': !base.holdings.buybackShips }">
          {{ count(base.holdings.buybackShips) }}
        </td>
        <td class="is-number" :class="{ 'is-none': !base.holdings.buybackCcus }">
          {{ count(base.holdings.buybackCcus) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

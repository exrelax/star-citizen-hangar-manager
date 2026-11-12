<script setup lang="ts">
import { formatUsd } from '@/hangar/discount-format';
import { i18n, locale } from '@/i18n';
import SvgIcon from '@/icons/SvgIcon.vue';
import { vTooltip } from '@/shared/tooltip/tooltip';
import { useShipFacts } from '@/ships/use-ship-facts';
import type { BaseShip } from '../warbond';
// Shared, unscoped styles of the store's tables; a plain import, as `<style src>` of the same file
// in several components breaks the build.
import './store-table.css';

/**
 * The ships to start CCUs from, cheapest CCU first: the CCU's price, the ship and its standard
 * price, and how often the user already has the ship – as ship or as target of a CCU – in the
 * hangar and the buy back. For the warbond CCUs and the CCUs to secure before a price increase.
 * A check marks the ships that are always available in the Pledge Store (the website's ship facts,
 * #109), so the user can get onto them later to apply the CCU.
 */
defineProps<{ bases: readonly BaseShip[] }>();

const shipFacts = useShipFacts();
const alwaysAvailable = (id: number) => shipFacts.value?.isAlwaysAvailable(id) === true;

const usd = (value: number) => formatUsd(value, locale.value);
/** A count; nothing for none, so the counts that matter stand out. */
const count = (value: number) => (value ? String(value) : '–');
</script>

<template>
  <table class="shm-warbond-table">
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
        <td>{{ base.ship.name }}</td>
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

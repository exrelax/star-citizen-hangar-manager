// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createApp, h, ref, shallowRef, type App, type ComputedRef } from 'vue';
import { DEMO_CONTEXT, type DemoContext } from '@/demo/use-demo';
import { buyableShipsItem, SHIPS_VERSION, shipsItem } from '@/ships/ships-storage';
import type { ExpectedPriceIncrease } from './price-increases';
import { PRICE_INCREASES_VERSION, priceIncreasesItem } from './price-increases-storage';
import type { SecureOffer } from './ccus-to-secure';
import { useCcusToSecure } from './use-ccus-to-secure';

/*
 * The price increases behind the CCUs to secure: the website's, in the demo its own (#255) –
 * unless the Pledge Store tab shows the real data (#310).
 */

const NOW = Date.parse('2026-11-12T12:00:00Z');
const increaseOf = (id: number, name: string): ExpectedPriceIncrease => ({
  ship: { id, name },
  priceIncreaseAt: { at: NOW + 3 * 24 * 60 * 60 * 1000 },
  price: { from: 155, to: 175 },
});
const real = increaseOf(109, 'Prospector');
const demo = increaseOf(165, 'Vulture');

let app: App | undefined;
beforeEach(async () => {
  fakeBrowser.reset();
  await shipsItem.setValue({
    version: SHIPS_VERSION,
    ships: [
      { id: 109, name: 'Prospector', msrp: 155 },
      { id: 165, name: 'Vulture', msrp: 155 },
      { id: 35, name: 'Arrow', msrp: 75 },
    ],
  });
  await buyableShipsItem.setValue({
    version: SHIPS_VERSION,
    skus: [109, 165].map((id) => ({ shipId: id, skuId: id, title: 'Standard Edition', price: 1 })),
  });
  await priceIncreasesItem.setValue({ version: PRICE_INCREASES_VERSION, priceIncreases: [real] });
});
afterEach(() => {
  app?.unmount();
  app = undefined;
});

/** The ships of the CCUs to secure, with or without a demo and the real data in it. */
async function securedShips(inDemo: boolean, realInDemo = false): Promise<string[]> {
  let secure: ComputedRef<SecureOffer[]> | undefined;
  app = createApp({
    setup() {
      secure = useCcusToSecure(
        () => [],
        () => [],
        ref(NOW),
        () => realInDemo,
      );
      return () => h('div');
    },
  });
  app.provide(
    DEMO_CONTEXT,
    shallowRef(inDemo ? ({ priceIncreases: [demo] } as unknown as DemoContext) : null),
  );
  app.mount(document.createElement('div'));
  // The stored values are read asynchronously.
  await new Promise((resolve) => setTimeout(resolve));
  return secure!.value.map((offer) => offer.ship.name);
}

describe('useCcusToSecure', () => {
  it('uses the website’s price increases outside the demo', async () => {
    expect(await securedShips(false)).toEqual(['Prospector']);
  });

  it('uses the demo’s own price increases in the demo (#255)', async () => {
    expect(await securedShips(true)).toEqual(['Vulture']);
  });

  it('uses the website’s in the demo with the real Pledge Store data (#310)', async () => {
    expect(await securedShips(true, true)).toEqual(['Prospector']);
  });
});

import { describe, expect, it } from 'vitest';
import { FALLBACK_CATALOG } from './catalog';
import { buybackComposition, generatedDemo } from './demo';
import { DEFAULT_DEMO_SETTINGS, demoSettingsOf } from './demo-settings';

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');

describe('demoSettingsOf (#178)', () => {
  it('keeps valid values and falls back to the defaults for the rest', () => {
    expect(demoSettingsOf(null)).toEqual(DEFAULT_DEMO_SETTINGS);
    const settings = demoSettingsOf({
      source: 'own',
      composition: { ships: 3, paints: 99 } as never,
      buybackPledges: 5,
      states: { refund: false, notGiftablePercent: 50 } as never,
    });
    expect(settings.source).toBe('own');
    expect(settings.composition.ships).toBe(3);
    expect(settings.composition.paints).toBe(DEFAULT_DEMO_SETTINGS.composition.paints);
    expect(settings.buybackPledges).toBe(DEFAULT_DEMO_SETTINGS.buybackPledges);
    expect(settings.states.refund).toBe(false);
    expect(settings.states.notGiftablePercent).toBe(50);
  });
});

describe('the demo settings in the generated demo', () => {
  it('set the composition and the size of the buy back', () => {
    const settings = demoSettingsOf({
      composition: { ...DEFAULT_DEMO_SETTINGS.composition, ships: 2, paints: 0 },
      buybackPledges: 20,
    });
    const { pledges, buyback } = generatedDemo(FALLBACK_CATALOG, 'key', TODAY, NOW, settings);
    // A reward may be a paint, too ("Referral Bonus - Mustang Alpha Paint").
    expect(pledges.filter((pledge) => pledge.isPaint && pledge.valueUsd > 0)).toHaveLength(0);
    expect(buyback.length).toBeGreaterThanOrEqual(20);
    expect(buyback.length).toBeLessThan(30);
    const total = Object.values(buybackComposition(100)).reduce((sum, value) => sum + value, 0);
    expect(total).toBeGreaterThanOrEqual(95);
  });

  it('turn states off', () => {
    const states = {
      ...DEFAULT_DEMO_SETTINGS.states,
      upgraded: false,
      protectedAccess: 'off' as const,
    };
    const off = demoSettingsOf({ states, buybackPledges: 50 });
    const { pledges } = generatedDemo(FALLBACK_CATALOG, 'key', TODAY, NOW, off);
    expect(pledges.some((pledge) => pledge.isUpgraded)).toBe(false);
    expect(pledges.some((pledge) => pledge.protectedGames.length)).toBe(false);
    const noRefund = demoSettingsOf({ states: { ...states, refund: false, justBought: false } });
    const dated = generatedDemo(FALLBACK_CATALOG, 'key', TODAY, NOW, noRefund).pledges;
    expect(dated.every((pledge) => !pledge.order || pledge.order.placedAt! < '2026-10-11')).toBe(
      true,
    );
  });
});

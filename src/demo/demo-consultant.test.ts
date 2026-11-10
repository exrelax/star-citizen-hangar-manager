import { describe, expect, it } from 'vitest';
import { planPaintRebuy, planPendingRebuy } from '@/store/paint-consultant/calculation';
import { noteText } from '@/notifications/notifications';
import { FALLBACK_CATALOG } from './catalog';
import { generatedHangar, justBoughtOf } from './demo';
import { demoKeptPlan } from './demo-consultant';
import { demoStoreNotes } from './demo-store-notes';

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const items = FALLBACK_CATALOG.items;

describe.each(['key-a', 'key-b', 'key-c'])('the consultant of the demo %s (#131)', (key) => {
  const pledges = generatedHangar(FALLBACK_CATALOG, key, TODAY, NOW);
  const fillers = [justBoughtOf(pledges)!];
  const plan = demoKeptPlan(pledges, items, fillers, NOW)!;
  const kept = { at: plan.at, ownPledgeIds: plan.own.map((paint) => paint.pledgeId) };

  it('has a paint bought again, its old pledge left to melt (#139)', () => {
    const result = planPaintRebuy({
      pledges,
      storeItems: items,
      storeCredit: 50,
      useFillers: true,
      skipGiftable: false,
      keptPlan: kept,
      guessRebought: false,
    });
    expect(result.rebought.length).toBeGreaterThan(0);
  });

  it('has paints melted first and left to buy again (#168)', () => {
    const pending = planPendingRebuy({
      kept: plan,
      pledges,
      storeItems: items,
      storeCredit: 50,
      useFillers: true,
    });
    expect(pending?.toBuy.length).toBeGreaterThan(0);
  });

  it('has filler paints bought with it (#105)', () => {
    expect(plan.purchase?.pledgeIds).toEqual(fillers);
  });
});

describe('the Pledge Store notifications of the demo (#131)', () => {
  it('tell new and gone warbond CCUs and changed store items', () => {
    const notes = demoStoreNotes(FALLBACK_CATALOG, 'en', NOW);
    expect(notes.map((note) => note.kind)).toEqual(['warbonds', 'storeItems']);
    expect(noteText(notes[1]!, 'en')).toMatch(/change/i);
  });
});

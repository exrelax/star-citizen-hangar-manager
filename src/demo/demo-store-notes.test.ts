import { describe, expect, it } from 'vitest';
import { noteText } from '@/notifications/notifications';
import { FALLBACK_CATALOG } from './catalog';
import { demoStoreNotes } from './demo-store-notes';

const NOW = Date.parse('2026-11-10T12:00:00Z');

describe('the Pledge Store notifications of the demo (#131)', () => {
  it('tell new and gone warbond CCUs and changed store items', () => {
    const notes = demoStoreNotes(FALLBACK_CATALOG, 'en', NOW);
    expect(notes.map((note) => note.kind)).toEqual(['warbonds', 'storeItems']);
    expect(noteText(notes[1]!, 'en')).toMatch(/change/i);
  });
});

import { describe, expect, it } from 'vitest';
import { storagesToTransfer } from '@/storage/registry';
import { buildSettingsExport, storagesOfPart } from './settings-export';

/* The export of settings and your data (#229). */

const NOW = new Date('2026-11-23T12:00:00Z');

const values = {
  settings: { theme: 'classic' },
  notifications: [{ id: 'fillers:1', doneAt: 1 }],
  dismissedPaints: [5],
  riskNoteSeen: true,
  dismissedPriceIncreases: [],
  dismissedPriceAdvisor: [],
  dismissedShipRemovals: ['a'],
  browserHintDismissed: false,
  warbondHistory: { version: 1, sightings: [] },
  paintPlan: { version: 2, own: [], fillers: [] },
  paintHistory: { version: 1, plans: [] },
  watchlists: [{ id: 'w1', name: 'Wanted', items: [] }],
  meltMarks: { 101: 1_700_000_000_000 },
  // Never in this export, even if handed in.
  hangar: { version: 3, pledges: [] },
};

describe('buildSettingsExport', () => {
  it('holds the settings with their decisions and your data, with their versions', () => {
    const file = buildSettingsExport(values, undefined, NOW, '1.2.0');
    expect(file).toMatchObject({ kind: 'settings', parts: ['settings', 'yourData'] });
    expect(Object.keys(file.storages).sort()).toEqual(
      [...storagesToTransfer('settings'), ...storagesToTransfer('yourData')]
        .map((storage) => storage.id)
        .sort(),
    );
    expect(file.storages.paintPlan?.version).toBe(2);
    expect(file.storages.watchlists).toEqual({ version: 1, value: values.watchlists });
    expect(file.storages.riskNoteSeen).toEqual({ version: 1, value: true });
  });

  it('holds nothing of the account', () => {
    const file = buildSettingsExport(values, undefined, NOW, '1');
    for (const id of ['hangar', 'buyback', 'orders', 'storeCredit', 'giftFlags'] as const) {
      expect(file.storages[id]).toBeUndefined();
    }
  });

  it('holds only the part chosen', () => {
    const settings = buildSettingsExport(values, ['settings'], NOW, '1');
    expect(settings.parts).toEqual(['settings']);
    expect(settings.storages.watchlists).toBeUndefined();
    expect(settings.storages.settings).toBeDefined();
    const yours = buildSettingsExport(values, ['yourData'], NOW, '1');
    expect(yours.parts).toEqual(['yourData']);
    expect(yours.storages.settings).toBeUndefined();
    expect(Object.keys(yours.storages)).toEqual(storagesOfPart('yourData').map((s) => s.id));
  });

  it('leaves out what is not stored', () => {
    const file = buildSettingsExport(
      { ...values, paintPlan: null, settings: null },
      undefined,
      NOW,
      '1',
    );
    expect(file.storages.paintPlan).toBeUndefined();
    expect(file.storages.settings).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { STORAGES, storagesToTransfer } from './registry';

/* What each storage exports (#633). */

describe('the transfer of each storage', () => {
  it('is set for every storage', () => {
    for (const storage of STORAGES) {
      expect(['hangar', 'yourData', 'settings', 'none'], storage.id).toContain(storage.transfer);
    }
  });

  it('exports everything that can never be read again', () => {
    for (const storage of STORAGES.filter((entry) => entry.readAgain === 'never')) {
      expect(storage.transfer, storage.id).not.toBe('none');
    }
  });

  it('exports what the user keeps in the synced storage as their data', () => {
    for (const storage of STORAGES.filter((entry) => entry.kind === 'synced')) {
      expect(storage.transfer, storage.id).toBe('yourData');
    }
  });

  it('puts the account, the user data and the settings in their exports', () => {
    const ids = (transfer: Parameters<typeof storagesToTransfer>[0]) =>
      storagesToTransfer(transfer).map((storage) => storage.id);
    expect(ids('hangar')).toEqual(['hangar', 'buyback', 'orders', 'storeCredit', 'giftFlags']);
    expect(ids('yourData')).toEqual([
      'warbondHistory',
      'paintPlan',
      'paintHistory',
      'watchlists',
      'meltMarks',
    ]);
    expect(ids('settings')).toEqual([
      'settings',
      'notifications',
      'dismissedPaints',
      'riskNoteSeen',
      'dismissedPriceIncreases',
      'dismissedPriceAdvisor',
      'dismissedShipRemovals',
      'browserHintDismissed',
    ]);
  });

  it('keeps the settings and their decisions out of the groups and the reset', () => {
    for (const storage of storagesToTransfer('settings')) {
      expect(storage.kind, storage.id).toBe('settings');
      expect(storage.group, storage.id).toBeUndefined();
    }
  });
});

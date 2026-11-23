import { describe, expect, it } from 'vitest';
import { STORAGES } from './registry';

/* What users keep across updates (#479, "Migrations and user data" in docs/DEVELOPMENT.md). */

describe('the registry', () => {
  it('says for every storage of data whether it can be read again', () => {
    for (const storage of STORAGES.filter((entry) => entry.kind !== 'settings')) {
      expect(['refresh', 'auto', 'never'], storage.id).toContain(storage.readAgain);
    }
  });

  it('never drops what the user made', () => {
    const userMade = STORAGES.filter(
      (entry) => entry.readAgain === 'never' || entry.kind !== 'data',
    );
    for (const storage of userMade) {
      expect(storage.obsoleteKeys ?? [], storage.id).toEqual([]);
    }
  });
});

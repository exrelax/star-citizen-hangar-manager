import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  maybeRefreshShipStatus,
  parseShipMatrix,
  shipStatusItem,
  shipStatusMeta,
  SHIP_STATUS_VERSION,
} from './ship-status';

const DAY = 24 * 60 * 60 * 1000;
const status = { version: SHIP_STATUS_VERSION, inConcept: [36, 244], count: 3 };

describe('parseShipMatrix (#252)', () => {
  it('keeps the ships in concept and the count', () => {
    expect(
      parseShipMatrix({
        data: [
          { id: 244, name: 'Galaxy', production_status: 'in-concept' },
          { id: 165, name: 'Vulture', production_status: 'flight-ready' },
          { id: 36, name: 'Merchantman', production_status: 'in-concept' },
        ],
      }),
    ).toEqual(status);
  });

  it('fails without ships, so the stored status is kept', () => {
    expect(() => parseShipMatrix({ data: [] })).toThrow();
    expect(() => parseShipMatrix(null)).toThrow();
  });
});

describe('maybeRefreshShipStatus', () => {
  beforeEach(() => fakeBrowser.reset());

  it('reads once a day, and in any case when forced', async () => {
    const fetchStatus = vi.fn(async () => status);
    await maybeRefreshShipStatus({ fetchStatus, now: () => 1000 });
    expect(await shipStatusItem.getValue()).toEqual(status);
    await maybeRefreshShipStatus({ fetchStatus, now: () => 1000 + DAY / 2 });
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    await maybeRefreshShipStatus({ fetchStatus, now: () => 1000 + DAY });
    await maybeRefreshShipStatus({ fetchStatus, force: true, now: () => 1000 + DAY });
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });

  it('keeps the stored status when reading fails', async () => {
    await shipStatusItem.setValue(status);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await maybeRefreshShipStatus({
      force: true,
      fetchStatus: async () => {
        throw new Error('offline');
      },
      now: () => 5000,
    });
    warn.mockRestore();
    expect(await shipStatusItem.getValue()).toEqual(status);
    expect((await shipStatusMeta.getValue()).lastOutcome?.status).toBe('failed');
  });
});

// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { currentWarbondsRequest, openCcusToSecure } from './open-current-warbonds';

describe('openCcusToSecure (#305)', () => {
  it('selects "Current Discount CCUs" in the Pledge Store tab, where the CCUs to secure are', () => {
    const before = currentWarbondsRequest.value;
    openCcusToSecure();
    expect(currentWarbondsRequest.value).toBe(before + 1);
    expect(location.hash).toBe('#hangar-manager-store');
  });
});

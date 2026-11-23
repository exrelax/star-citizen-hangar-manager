import { describe, expect, it } from 'vitest';
import { isOverBulkLimit } from './bulk-melting-limit';

/* The bulk melting button of the "Selected" box against the limit of the settings (#622). */

describe('isOverBulkLimit', () => {
  it('lets fewer pledges than the limit and as many as it melt', () => {
    expect(isOverBulkLimit(3, 10)).toBe(false);
    expect(isOverBulkLimit(10, 10)).toBe(false);
  });

  it('stops more pledges than the limit', () => {
    expect(isOverBulkLimit(11, 10)).toBe(true);
    expect(isOverBulkLimit(3, 2)).toBe(true);
  });
});

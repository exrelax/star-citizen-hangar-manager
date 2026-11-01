import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './pool';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('mapWithConcurrency', () => {
  it('keeps the input order and never exceeds the limit', async () => {
    let running = 0;
    let maxRunning = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await tick();
      running--;
      return value * 10;
    });

    expect(result).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(maxRunning).toBe(3);
  });

  it('rejects with the first error and starts no further tasks', async () => {
    const started: number[] = [];
    const run = mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
      started.push(value);
      await tick();
      if (value === 2) throw new Error('boom');
      return value;
    });

    await expect(run).rejects.toThrow('boom');
    expect(started).not.toContain(5);
  });

  it('handles an empty input', async () => {
    expect(await mapWithConcurrency([], 3, async () => 1)).toEqual([]);
  });
});

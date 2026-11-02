import { describe, expect, it } from 'vitest';
import { SyncProgressTracker } from './sync-progress';

describe('SyncProgressTracker', () => {
  it('counts pages and weights the bar by their work', () => {
    const tracker = new SyncProgressTracker();
    tracker.expect(10, 100);
    tracker.expect(2, 300);
    tracker.complete(10, 100);
    expect(tracker.progress).toEqual({ done: 10, total: 12, fraction: 0.25 });
  });

  it('counts steps without pages only in the bar', () => {
    const tracker = new SyncProgressTracker();
    tracker.expect(1, 50);
    tracker.expect(0, 50);
    tracker.complete(1, 50);
    expect(tracker.progress).toEqual({ done: 1, total: 1, fraction: 0.5 });
    tracker.complete(0, 50);
    expect(tracker.progress.fraction).toBe(1);
  });

  it('spreads work announced after the start over the rest of the bar', () => {
    const fractions: number[] = [];
    const tracker = new SyncProgressTracker((progress) => fractions.push(progress.fraction));
    tracker.expect(4, 400);
    tracker.start();
    tracker.complete(2, 200);
    // Half done; 4 detail pages show up – the bar stays at 50 % instead of dropping to 25 %.
    tracker.expect(4, 400);
    tracker.complete(2, 200);
    tracker.complete(4, 400);

    // Then 200 of the remaining 600 are done: a third of the empty half.
    expect(fractions).toEqual([0, 0.5, 0.5, 0.5 + 0.5 / 3, 1]);
    expect(tracker.progress).toMatchObject({ done: 8, total: 8 });
  });
});

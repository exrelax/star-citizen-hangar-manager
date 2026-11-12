import { describe, expect, it } from 'vitest';
import { consultantTabsOf, shownTabOf } from './consultant-tabs';

describe("the consultant's tabs (#244)", () => {
  it('has only the tabs with something to show, in their order', () => {
    expect(consultantTabsOf({ running: true, new: true, completed: true })).toEqual([
      'running',
      'new',
      'completed',
    ]);
    expect(consultantTabsOf({ running: false, new: true, completed: true })).toEqual([
      'new',
      'completed',
    ]);
    expect(consultantTabsOf({ running: true, new: false, completed: false })).toEqual(['running']);
    expect(consultantTabsOf({ running: false, new: false, completed: false })).toEqual([]);
  });

  it('shows the chosen tab while it is there, else the first one', () => {
    expect(shownTabOf(['running', 'new'], undefined)).toBe('running');
    expect(shownTabOf(['running', 'new'], 'new')).toBe('new');
    // The running plan ended: the chosen tab is gone.
    expect(shownTabOf(['new', 'completed'], 'running')).toBe('new');
    expect(shownTabOf([], 'new')).toBeUndefined();
  });
});

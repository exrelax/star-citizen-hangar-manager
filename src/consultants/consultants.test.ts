import { describe, expect, it } from 'vitest';
import { consultantsOf, shownConsultantOf } from './consultants';

describe('the consultants of the tab "Consultants" (#453)', () => {
  it('shows each consultant only with something to offer, the CCU Consultant without any', () => {
    expect(consultantsOf({ ccu: true, paint: true })).toEqual(['ccu', 'paint']);
    expect(consultantsOf({ ccu: true, paint: false })).toEqual(['ccu']);
    expect(consultantsOf({ ccu: false, paint: true })).toEqual(['paint']);
    expect(consultantsOf({ ccu: false, paint: false })).toEqual(['ccu']);
  });

  it('shows the chosen one while it is there, else the first one', () => {
    expect(shownConsultantOf(['ccu', 'paint'], 'paint')).toBe('paint');
    expect(shownConsultantOf(['ccu'], 'paint')).toBe('ccu');
    expect(shownConsultantOf(['ccu', 'paint'], undefined)).toBe('ccu');
  });
});

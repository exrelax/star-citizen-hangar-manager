// @vitest-environment happy-dom
import faSprite from '@/assets/svg-sprites/fa.svg?raw';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from './icon-names';
import { ensureSprite, symbolId } from './sprite';

describe('icon sprites', () => {
  it('have a symbol with a viewBox for every icon name', () => {
    for (const name of ICON_NAMES.fa) {
      expect(faSprite).toMatch(new RegExp(`<symbol id="${symbolId('fa', name)}" viewBox="[^"]+"`));
    }
  });

  it('are added to the page once', () => {
    ensureSprite('fa');
    ensureSprite('fa');
    expect(document.querySelectorAll('#shm-icon-sprite-fa')).toHaveLength(1);
    expect(document.getElementById(symbolId('fa', 'circle-xmark'))).not.toBeNull();
  });
});

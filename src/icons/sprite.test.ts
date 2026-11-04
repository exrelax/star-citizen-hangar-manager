// @vitest-environment happy-dom
import customSprite from '@/assets/svg-sprites/custom.svg?raw';
import faSprite from '@/assets/svg-sprites/fa.svg?raw';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from './icon-names';
import { ensureSprite, symbolId } from './sprite';

describe('icon sprites', () => {
  it('have a symbol with a viewBox for every icon name', () => {
    const sprites = { fa: faSprite, custom: customSprite };
    for (const set of Object.keys(ICON_NAMES) as (keyof typeof ICON_NAMES)[]) {
      for (const name of ICON_NAMES[set]) {
        expect(sprites[set]).toMatch(
          new RegExp(`<symbol id="${symbolId(set, name)}" viewBox="[^"]+"`),
        );
      }
    }
  });

  it('are added to the page once', () => {
    ensureSprite('fa');
    ensureSprite('fa');
    expect(document.querySelectorAll('#shm-icon-sprite-fa')).toHaveLength(1);
    expect(document.getElementById(symbolId('fa', 'circle-xmark'))).not.toBeNull();
  });
});

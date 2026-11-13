import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICONS_FOLDER, iconSprite, symbolOf } from './icons.ts';

describe('iconSprite', () => {
  it('has a symbol per icon file, with its viewBox, and the license once', () => {
    const sprite = iconSprite();
    const files = readdirSync(ICONS_FOLDER).filter((file) => file.endsWith('.svg'));
    expect(sprite.match(/<symbol /g)).toHaveLength(files.length);
    expect(sprite).toContain('<symbol id="icon-github" viewBox="');
    expect(sprite.match(/fontawesome\.com\/license\/free/g)).toHaveLength(1);
    expect(sprite.startsWith('<svg class="icon-sprite" aria-hidden="true">')).toBe(true);
  });

  it('keeps only the shapes of an icon', () => {
    const symbol = symbolOf(
      'dot',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10"><!-- note --><circle cx="5" cy="5" r="5"/></svg>',
    );
    expect(symbol).toBe(
      '<symbol id="icon-dot" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></symbol>',
    );
  });
});

describe('the pages', () => {
  it('use only icons of the sprite', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sprite = iconSprite();
    for (const file of ['index.html', 'privacy.html']) {
      const page = readFileSync(join(import.meta.dirname, file), 'utf8');
      expect(page).toContain('<!-- icons -->');
      for (const [, name] of page.matchAll(/href="#icon-([a-z-]+)"/g)) {
        expect(sprite, `${file}: icon-${name}`).toContain(`id="icon-${name}"`);
      }
    }
  });
});

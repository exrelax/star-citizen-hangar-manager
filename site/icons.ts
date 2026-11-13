import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { optimize } from 'svgo';

/*
 * The icons of the website: Font Awesome Free (CC BY 4.0), one SVG file each in `site/icons/`,
 * as downloaded from Font Awesome. While building, they become one inline sprite at the
 * `<!-- icons -->` placeholder of every page (see site/vite.config.ts), with a
 * `<symbol id="icon-<name>">` per file; a page uses one with
 * `<svg class="icon" aria-hidden="true"><use href="#icon-<name>"></use></svg>`.
 *
 * A new icon: put its SVG of the same Font Awesome version into `site/icons/`.
 */

export const ICONS_FOLDER = join(import.meta.dirname, 'icons');

/** Kept once in the sprite: Font Awesome Free asks for attribution in the files. */
const LICENSE =
  'Font Awesome Free by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright Fonticons, Inc.';

/** One icon file as a `<symbol>`: its viewBox and its shapes, without comments or sizes. */
export function symbolOf(name: string, source: string): string {
  const svg = optimize(source, {
    multipass: true,
    plugins: [{ name: 'preset-default' }, 'removeDimensions', 'removeXMLNS'],
  }).data;
  const viewBox = /<svg\b[^>]*\bviewBox="([^"]+)"/.exec(svg)?.[1];
  const body = /<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/.exec(svg)?.[1];
  if (!viewBox || body === undefined) throw new Error(`site/icons/${name}.svg: no viewBox`);
  const shapes = body.replace(/<!--[\s\S]*?-->/g, '').trim();
  return `<symbol id="icon-${name}" viewBox="${viewBox}">${shapes}</symbol>`;
}

/** The sprite of all icons in `folder`, sorted by name, hidden from the page and from readers. */
export function iconSprite(folder = ICONS_FOLDER): string {
  const symbols = readdirSync(folder)
    .filter((file) => file.endsWith('.svg'))
    .sort()
    .map((file) => symbolOf(file.slice(0, -4), readFileSync(join(folder, file), 'utf8')));
  return `<svg class="icon-sprite" aria-hidden="true"><!-- ${LICENSE} -->${symbols.join('')}</svg>`;
}

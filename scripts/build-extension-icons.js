/**
 * Renders the extension's icons (`pnpm icons`) from the logo in `src/assets/logo/` – the hangar
 * of the "My Hangar" tab in colour: the full logo from 64 px, without the small details at
 * 32–48 px, only the hangar at 16 px, where more detail would blur.
 *
 * Writes `public/icon/<size>.png`, which WXT turns into the manifest's icons.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const SOURCE = 'src/assets/logo';
const TARGET = 'public/icon';
/** Size in px → the logo drawn at it. */
const SIZES = {
  16: 'logo-tiny.svg',
  32: 'logo-mid.svg',
  48: 'logo-mid.svg',
  96: 'logo-full.svg',
  128: 'logo-full.svg',
};

fs.mkdirSync(TARGET, { recursive: true });
for (const [size, file] of Object.entries(SIZES)) {
  const svg = fs.readFileSync(path.join(SOURCE, file), 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: Number(size) } }).render().asPng();
  const target = path.join(TARGET, `${size}.png`);
  fs.writeFileSync(target, png);
  console.log(`${target}: ${file}, ${png.length} bytes`);
}

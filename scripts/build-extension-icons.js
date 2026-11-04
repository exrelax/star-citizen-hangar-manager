/**
 * Renders the extension's icons (`pnpm icons`) from the logo in `src/assets/logo/` – the hangar
 * of the "My Hangar" tab in colour: the full logo from 64 px, without the small details at
 * 32–48 px, only the hangar at 16 px, where more detail would blur.
 *
 * The 128 px icon is also the Chrome Web Store's icon. As Google asks, it draws the logo at 96 px
 * with 16 px of transparent padding on each side, so it looks as large as other extensions' icons.
 *
 * Writes `public/icon/<size>.png`, which WXT turns into the manifest's icons.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const SOURCE = 'src/assets/logo';
const TARGET = 'public/icon';
/** Size in px → the logo drawn at it, and the transparent padding around it in px. */
const SIZES = {
  16: { file: 'logo-tiny.svg' },
  32: { file: 'logo-mid.svg' },
  48: { file: 'logo-mid.svg' },
  96: { file: 'logo-full.svg' },
  128: { file: 'logo-full.svg', padding: 16 },
};

/** The logo at `size` px, `padding` px away from each edge (nested in a larger SVG). */
function withPadding(svg, size, padding) {
  const inner = size - 2 * padding;
  const logo = svg.replace(
    '<svg ',
    `<svg x="${padding}" y="${padding}" width="${inner}" height="${inner}" `,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${logo}</svg>`;
}

fs.mkdirSync(TARGET, { recursive: true });
for (const [key, { file, padding = 0 }] of Object.entries(SIZES)) {
  const size = Number(key);
  const logo = fs.readFileSync(path.join(SOURCE, file), 'utf8');
  const svg = padding ? withPadding(logo, size, padding) : logo;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  const target = path.join(TARGET, `${size}.png`);
  fs.writeFileSync(target, png);
  console.log(`${target}: ${file}${padding ? `, ${padding} px padding` : ''}, ${png.length} bytes`);
}

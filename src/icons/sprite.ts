import customSprite from '@/assets/svg-sprites/custom.svg?raw';
import faSprite from '@/assets/svg-sprites/fa.svg?raw';
import type { IconSet } from './icon-names';

/*
 * The icon sprites (built by `pnpm svg-sprite`) are added to the page once, hidden, when the
 * first icon is shown. `<use href="#…">` only finds symbols in the same document – a sprite file
 * of the extension (another origin) can't be referenced from RSI's page.
 */

const SPRITES: Record<IconSet, string> = { fa: faSprite, custom: customSprite };
const added = new Set<IconSet>();

/** Adds the sprite of `set` to the page, unless it is already there. */
export function ensureSprite(set: IconSet, doc: Document = document): void {
  if (added.has(set)) return;
  added.add(set);
  const id = `shm-icon-sprite-${set}`;
  if (doc.getElementById(id)) return;
  const holder = doc.createElement('div');
  holder.id = id;
  holder.hidden = true;
  holder.setAttribute('aria-hidden', 'true');
  // Bundled with the extension, not page content.
  holder.innerHTML = SPRITES[set];
  doc.body.append(holder);
}

/** The id of an icon's symbol in its sprite. */
export const symbolId = (set: IconSet, name: string) => `shm-icon-${set}-${name}`;

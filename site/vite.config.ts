import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/*
 * The project website (GitHub Pages): plain HTML and CSS in `site/`, built by Vite.
 *
 * Images are referenced from where they already live (`store/`, `public/icon/`,
 * `src/assets/logo/`) with relative paths; Vite copies them into the build with hashed names, so
 * nothing is duplicated in the repository.
 *
 * - `pnpm site:dev`: dev server with live reload
 * - `pnpm site:build`: builds into `.output/site`, which the "Website" workflow deploys
 * - `pnpm site:preview`: serves that build locally
 */
const root = fileURLToPath(new URL('.', import.meta.url));
const repository = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root,
  // Relative URLs: the site works under any path, e.g. /star-citizen-hangar-manager/ on GitHub
  // Pages, or a custom domain later.
  base: './',
  // Everything the site shows is referenced from the HTML; there is nothing to copy as is.
  publicDir: false,
  server: {
    // The images live outside `site/`.
    fs: { allow: [repository] },
  },
  build: {
    outDir: `${repository}/.output/site`,
    emptyOutDir: true,
    // Images stay files (cacheable, lazy-loadable) instead of being inlined into the HTML.
    assetsInlineLimit: 0,
  },
});

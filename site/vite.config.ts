import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { fetchRoadmap, renderRoadmap } from './roadmap/roadmap.ts';

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
 *
 * The roadmap is loaded from GitHub's API while building (see `roadmap/roadmap.ts`). Set
 * `GITHUB_TOKEN` to group the issues by the columns of the project board; without it, they are
 * grouped into open and done.
 */
const root = fileURLToPath(new URL('.', import.meta.url));
const repository = fileURLToPath(new URL('..', import.meta.url));

/** Folders outside `site/` that the site's images come from. */
const IMAGE_FOLDERS = ['/store/', '/public/', '/src/assets/'];

/**
 * In the dev server, a relative path like `../store/…` ends up as `/store/…` (it can't go above
 * the root). This serves those paths from the repository; the build resolves them on its own.
 */
const serveRepositoryImages: Plugin = {
  name: 'serve-repository-images',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (IMAGE_FOLDERS.some((folder) => request.url?.startsWith(folder))) {
        request.url = `/@fs${repository}${request.url!.slice(1)}`;
      }
      next();
    });
  },
};

/** The placeholder in index.html that the roadmap replaces. */
const ROADMAP_PLACEHOLDER = '<!-- roadmap -->';

/**
 * Renders the roadmap into index.html. In a build, a failed request fails the build, so the
 * "Website" workflow never publishes an empty roadmap: the last deployment stays online. The dev
 * server loads it once and shows a note instead if GitHub can't be reached.
 */
function roadmap(): Plugin {
  let html: Promise<string> | undefined;
  let isBuild = false;
  const warn = (message: string) =>
    console.warn(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `[roadmap] ${message}`);
  return {
    name: 'roadmap',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    transformIndexHtml(page) {
      if (!page.includes(ROADMAP_PLACEHOLDER)) return page;
      html ??= fetchRoadmap({ token: process.env.GITHUB_TOKEN, warn })
        .then(renderRoadmap)
        .catch((error: unknown) => {
          if (isBuild) throw error;
          warn(`GitHub can't be reached: ${String(error)}`);
          return '<p class="muted">The roadmap couldn\'t be loaded from GitHub.</p>';
        });
      return html.then((rendered) => page.replace(ROADMAP_PLACEHOLDER, rendered));
    },
  };
}

export default defineConfig({
  root,
  plugins: [serveRepositoryImages, roadmap()],
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

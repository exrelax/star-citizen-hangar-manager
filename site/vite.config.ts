import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { parsePrivacy, renderPrivacy } from './privacy/privacy.ts';
import { fetchRoadmap, renderRoadmap, renderVersion } from './roadmap/roadmap.ts';

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
 *
 * The privacy page (`privacy.html`) is made from the repository's PRIVACY.md (see
 * `privacy/privacy.ts`), so the policy has a single source.
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

/** The placeholders in index.html: the roadmap and the current version in the hero. */
const ROADMAP_PLACEHOLDER = '<!-- roadmap -->';
const VERSION_PLACEHOLDER = '<!-- version -->';

/** The version of package.json: shown if there is no GitHub release yet. */
const PACKAGE_VERSION = (
  JSON.parse(readFileSync(`${repository}package.json`, 'utf8')) as { version: string }
).version;

/**
 * Renders the roadmap and the current version into index.html. In a build, a failed request fails
 * the build, so the "Website" workflow never publishes an empty roadmap: the last deployment stays
 * online. The dev server loads it once and shows a note instead if GitHub can't be reached.
 */
function roadmap(): Plugin {
  let rendered: Promise<{ roadmap: string; version: string }> | undefined;
  let isBuild = false;
  const warn = (message: string) =>
    console.warn(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `[roadmap] ${message}`);
  return {
    name: 'roadmap',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    transformIndexHtml(page) {
      if (!page.includes(ROADMAP_PLACEHOLDER) && !page.includes(VERSION_PLACEHOLDER)) return page;
      rendered ??= fetchRoadmap({
        token: process.env.GITHUB_TOKEN,
        warn,
        fallbackVersion: PACKAGE_VERSION,
      })
        .then((data) => ({ roadmap: renderRoadmap(data), version: renderVersion(data.release) }))
        .catch((error: unknown) => {
          if (isBuild) throw error;
          warn(`GitHub can't be reached: ${String(error)}`);
          return {
            roadmap: '<p class="muted">The roadmap couldn\'t be loaded from GitHub.</p>',
            version: renderVersion({ version: PACKAGE_VERSION }),
          };
        });
      return rendered.then(({ roadmap, version }) =>
        page.replace(ROADMAP_PLACEHOLDER, roadmap).replace(VERSION_PLACEHOLDER, version),
      );
    },
  };
}

/** Where the site is published (GitHub Pages); the canonical and preview URLs point here. */
export const SITE_URL = 'https://exrelax.github.io/star-citizen-hangar-manager/';

/**
 * Open Graph and X need absolute image URLs. Vite writes the preview image as a relative URL
 * (`./assets/…`, see `base`) when it finishes the HTML; this turns it into one below SITE_URL
 * in the built pages.
 */
const absolutePreviewImages: Plugin = {
  name: 'absolute-preview-images',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue;
      file.source = String(file.source).replace(
        /(<meta (?:property="og:image"|name="twitter:image") content=")\.\/([^"]+)"/g,
        (_match, start: string, path: string) => `${start}${SITE_URL}${path}"`,
      );
    }
  },
};

/** PRIVACY.md, the single source of the privacy page. */
const PRIVACY_FILE = `${repository}PRIVACY.md`;
const PRIVACY_PLACEHOLDER = '<!-- privacy -->';

/** Renders PRIVACY.md into privacy.html; the dev server reloads the page when the file changes. */
const privacyPage: Plugin = {
  name: 'privacy-page',
  configureServer(server) {
    server.watcher.add(PRIVACY_FILE);
    server.watcher.on('change', (file) => {
      if (file === PRIVACY_FILE) server.ws.send({ type: 'full-reload' });
    });
  },
  transformIndexHtml(page) {
    if (!page.includes(PRIVACY_PLACEHOLDER)) return page;
    const rendered = renderPrivacy(parsePrivacy(readFileSync(PRIVACY_FILE, 'utf8')));
    return page.replace(PRIVACY_PLACEHOLDER, rendered);
  },
};

export default defineConfig({
  root,
  plugins: [serveRepositoryImages, roadmap(), privacyPage, absolutePreviewImages],
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
    rollupOptions: {
      input: { index: `${root}index.html`, privacy: `${root}privacy.html` },
    },
  },
});

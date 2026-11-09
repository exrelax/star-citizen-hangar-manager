import { defineConfig } from 'wxt';

// One code base, two targets: `wxt build -b chrome` and `wxt build -b firefox`.
// Both targets are built as Manifest V3.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue', '@wxt-dev/i18n/module'],
  manifestVersion: 3,
  imports: {
    // Generates .wxt/eslint-auto-imports.mjs so ESLint knows WXT's auto-imported globals.
    eslintrc: { enabled: 9 },
  },
  dev: {
    server: {
      // Lets tools that assign a free port (via PORT) find the dev server.
      port: Number(process.env.PORT) || 3000,
    },
  },
  zip: {
    // The sources zip for addons.mozilla.org needs only what builds the extension: the store
    // texts and images (several MB) and the project website stay out.
    excludeSources: ['store/**', 'site/**'],
  },
  hooks: {
    // The styleguide (src/entrypoints/styleguide) is a page for development: `wxt build` skips it.
    'entrypoints:resolved': (wxt, entrypoints) => {
      if (wxt.config.command !== 'build') return;
      for (const entrypoint of entrypoints) {
        if (entrypoint.name === 'styleguide') entrypoint.skipped = true;
      }
    },
  },
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // unlimitedStorage: large hangars can exceed the default quota of storage.local.
    permissions: ['storage', 'unlimitedStorage'],
    // Asked for only when the user turns browser notifications on (#152): no prompt at install
    // or update, and nothing changes without it (see src/notifications/browser-permission.ts).
    optional_permissions: ['notifications'],
    host_permissions: ['https://robertsspaceindustries.com/*'],
    // The toolbar icon opens the popup with links to the manager (src/entrypoints/popup).
    action: {
      default_title: '__MSG_extName__',
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // The add-on's ID on addons.mozilla.org. Bound to the add-on with its first upload: never
          // change it, or Firefox treats the extension as a new add-on.
          id: 'star-citizen-hangar-manager@exrelax',
          // `data_collection_permissions` needs Firefox 140 (ESR).
          strict_min_version: '140.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
      },
    }),
  }),
});

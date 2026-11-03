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
    host_permissions: ['https://robertsspaceindustries.com/*'],
    // The toolbar icon opens the popup with links to the manager (src/entrypoints/popup).
    action: {
      default_title: '__MSG_extName__',
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // TODO: replace with the final add-on ID before publishing on addons.mozilla.org
          id: 'sc-hangar-manager@extension',
          strict_min_version: '128.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
      },
    }),
  }),
});

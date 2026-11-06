import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // WxtVitest doesn't load WXT's modules, so `.vue` files (component tests) need the plugin.
  plugins: [WxtVitest(), vue()],
  test: {
    include: ['src/**/*.test.ts', 'site/**/*.test.ts'],
  },
});

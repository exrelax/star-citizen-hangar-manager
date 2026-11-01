import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import autoImports from './.wxt/eslint-auto-imports.mjs';

export default defineConfigWithVueTs(
  { ignores: ['.output/**', '.wxt/**', 'coverage/**'] },
  autoImports,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  skipFormatting,
);

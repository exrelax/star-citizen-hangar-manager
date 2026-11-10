/**
 * Whether the settings show the tools for developing the extension (DevelopmentSection.vue):
 * development builds only, and not on the styleguide itself (see wxt.config.ts).
 */
export const DEVELOPMENT_SHOWN =
  import.meta.env.DEV && !location.pathname.endsWith('/styleguide.html');

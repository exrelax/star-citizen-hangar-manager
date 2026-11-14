import { locale } from '@/i18n';
import { extensionVersion } from '@/shared/extension-version';

/*
 * The header of a copied error report (#342): what the maintainer needs to match the errors with
 * the code – the extension's version, the browser, the language and theme of the extension, and
 * whether the demo mode is on. Shared by "Copy details" (#334) and "Copy log" (#340).
 */

export interface ReportContext {
  version: string;
  userAgent: string;
  language: string;
  theme: string;
  demoMode: boolean;
}

export function reportHeader(context: ReportContext): string {
  return [
    `Star Citizen Hangar Manager ${context.version}`,
    context.userAgent,
    `Language: ${context.language} · Theme: ${context.theme} · ` +
      `Demo mode: ${context.demoMode ? 'on' : 'off'}`,
  ].join('\n');
}

/** The context of this browser, with the settings' theme and demo mode. */
export const currentReportContext = (settings: {
  theme: string;
  demoMode: boolean;
}): ReportContext => ({
  version: extensionVersion(),
  userAgent: navigator.userAgent,
  language: locale.value,
  theme: settings.theme,
  demoMode: settings.demoMode,
});

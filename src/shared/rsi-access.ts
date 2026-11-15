/*
 * The extension's access to RSI's website, which its content script needs to run there. Chrome
 * grants it at install, but Firefox treats the host permissions of a Manifest V3 extension as
 * optional: loaded as a temporary add-on, or taken back in `about:addons`, the extension has no
 * access, and nothing shows on RSI's pages – without an error. Chrome users can restrict it too
 * ("Site access: on click"). The popup says so and asks for it; once granted, the open RSI tabs
 * are loaded again so the Hangar Manager shows up.
 */

export const RSI_ORIGIN = 'https://robertsspaceindustries.com/*';

/** A new object each time: the browser's API takes a mutable list. */
export const rsiAccess = (): { origins: [string] } => ({ origins: [RSI_ORIGIN] });

/** Whether the extension may run on RSI's website. */
export async function hasRsiAccess(
  contains: (permissions: { origins: string[] }) => Promise<boolean> = (permissions) =>
    browser.permissions.contains(permissions),
): Promise<boolean> {
  try {
    return await contains(rsiAccess());
  } catch {
    // An unexpected answer: better no hint than a wrong one.
    return true;
  }
}

/**
 * Asks the browser for the access – call it right in a click handler, before anything else is
 * awaited, or the browser refuses to ask.
 */
export function requestRsiAccess(): Promise<boolean> {
  return browser.permissions.request(rsiAccess());
}

/** Whether newly granted permissions include RSI's website. */
export const grantsRsiAccess = (permissions: { origins?: string[] }): boolean =>
  !!permissions.origins?.some((origin) => origin.startsWith('https://robertsspaceindustries.com'));

/** Loads the open RSI tabs again, so the content script runs in them. */
export async function reloadRsiTabs(): Promise<void> {
  const tabs = await browser.tabs.query({ url: RSI_ORIGIN });
  await Promise.all(
    tabs.flatMap((tab) => (tab.id === undefined ? [] : [browser.tabs.reload(tab.id)])),
  );
}

/**
 * The extension's version, e.g. "1.0.0". WXT writes the `version` of package.json into the
 * manifest, so package.json is the only place to change it.
 */
export const extensionVersion = (): string => browser.runtime.getManifest().version;

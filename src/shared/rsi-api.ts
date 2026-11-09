/*
 * Requests to RSI's JSON APIs, from an RSI page (content script) or from the background script
 * (#163). Both send RSI's cookies: the page as the site itself, the background through the host
 * permission for robertsspaceindustries.com. Only the page has `document.cookie` for the session
 * token header; the reads the background makes (Pledge Store, upgrade tool) don't need it.
 */

/** RSI's website: requests go here, also from the background script, which has no page. */
export const RSI_ORIGIN = 'https://robertsspaceindustries.com';

/** Cookie with the session token RSI expects in the `X-Rsi-Token` header. */
const TOKEN_COOKIE = 'Rsi-Token';

/** The URL of a path on RSI's website. */
export const rsiUrl = (path: string) => new URL(path, RSI_ORIGIN).href;

/** The session token of the page; none in the background script (no `document`). */
function sessionToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${TOKEN_COOKIE}=`))
    ?.slice(TOKEN_COOKIE.length + 1);
}

/** RSI's answer when nobody is signed in (or the session expired) and the API needs an account. */
export class RsiSignedOutError extends Error {
  constructor(message = 'Not signed in to RSI') {
    super(message);
    this.name = 'RsiSignedOutError';
  }
}

/**
 * A POST request to one of RSI's JSON APIs, as RSI's own scripts send it: with the session token
 * of the page, if there is one. Throws on HTTP errors; whether RSI accepted the request is up to
 * the caller.
 */
export async function postRsiJson<T>(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const token = sessionToken();
  const response = await fetch(rsiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // RSI's messages are shown as they are; the extension asks for English like for the pages.
      'Accept-Language': 'en',
      ...(token && { 'X-Rsi-Token': token }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

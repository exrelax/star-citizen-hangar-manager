/** Cookie with the session token RSI expects in the `X-Rsi-Token` header. */
const TOKEN_COOKIE = 'Rsi-Token';

/**
 * A POST request to one of RSI's JSON APIs, as RSI's own scripts send it: with the session token
 * of the page. Throws on HTTP errors; whether RSI accepted the request is up to the caller.
 */
export async function postRsiJson<T>(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const token = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${TOKEN_COOKIE}=`))
    ?.slice(TOKEN_COOKIE.length + 1);
  const response = await fetch(path, {
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

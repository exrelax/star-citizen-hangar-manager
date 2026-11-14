/** The longest wait a server's `Retry-After` may ask for before a try again. */
const MAX_RETRY_AFTER_MS = 30_000;

/**
 * Runs `task`, and again after each of `delaysMs` while it fails with an error `shouldRetry`
 * accepts (e.g. throttling). An error with `retryAfterMs` (see `httpError`) waits at least that
 * long, up to half a minute. Other errors, and the last one, are thrown.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  delaysMs: readonly number[],
  shouldRetry: (error: unknown) => boolean,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= delaysMs.length || !shouldRetry(error)) throw error;
      const asked = Math.min(retryAfterOf(error) ?? 0, MAX_RETRY_AFTER_MS);
      await new Promise((resolve) => setTimeout(resolve, Math.max(delaysMs[attempt]!, asked)));
    }
  }
}

/** An error of a failed request whose message ends in "HTTP <status>", as the checks expect. */
export interface HttpError extends Error {
  status: number;
  /** The full URL that was requested (#342). */
  url?: string;
  /** How long the server asked to wait (`Retry-After`), in ms. */
  retryAfterMs?: number;
}

/** The full URL of a request, also of a path relative to the page. */
export function absoluteUrl(url: string): string {
  try {
    return new URL(url, globalThis.location?.href).href;
  } catch {
    return url;
  }
}

/** `error` with the URL of the request it failed on (#342), e.g. for "Failed to fetch". */
export function withUrl<T>(error: T, url: string): T {
  if (error instanceof Error && !(error as Partial<HttpError>).url) {
    (error as Partial<HttpError>).url = absoluteUrl(url);
  }
  return error;
}

/** The URL of the request an error failed on, if known. */
export const urlOf = (error: unknown): string | undefined =>
  error instanceof Error ? (error as Partial<HttpError>).url : undefined;

/**
 * The error of a response that isn't ok, with `message` (ending in "HTTP <status>"), its status,
 * the URL requested and its `Retry-After`.
 */
export function responseError(message: string, response: Response, url?: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = response.status;
  const requested = url ?? response.url;
  if (requested) error.url = absoluteUrl(requested);
  const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
  if (retryAfter !== undefined) error.retryAfterMs = retryAfter;
  return error;
}

/** The error of a response that isn't ok: "<what> failed: HTTP <status>". */
export const httpError = (what: string, response: Response, url?: string): HttpError =>
  responseError(`${what} failed: HTTP ${response.status}`, response, url);

/** `Retry-After` in ms: seconds or an HTTP date; undefined without a usable value. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

const retryAfterOf = (error: unknown) =>
  error instanceof Error ? (error as Partial<HttpError>).retryAfterMs : undefined;

/** Whether a request failed because the server throttles (HTTP 429). */
export const isThrottled = (error: unknown) =>
  error instanceof Error && /\bHTTP 429\b/.test(error.message);

/**
 * Whether a request failed for a reason that may pass: throttling (HTTP 429), a server error
 * (HTTP 5xx) or no answer at all (`fetch` rejects with a `TypeError`).
 */
export const isTransient = (error: unknown) =>
  error instanceof TypeError ||
  (error instanceof Error && /\bHTTP (?:429|5\d\d)\b/.test(error.message));

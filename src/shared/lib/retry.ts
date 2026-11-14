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
  /** How long the server asked to wait (`Retry-After`), in ms. */
  retryAfterMs?: number;
}

/** The error of a response that isn't ok: "<what> failed: HTTP <status>", with its `Retry-After`. */
export function httpError(what: string, response: Response): HttpError {
  const error = new Error(`${what} failed: HTTP ${response.status}`) as HttpError;
  error.status = response.status;
  const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
  if (retryAfter !== undefined) error.retryAfterMs = retryAfter;
  return error;
}

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

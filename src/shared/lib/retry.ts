/**
 * Runs `task`, and again after each of `delaysMs` while it fails with an error `shouldRetry`
 * accepts (e.g. throttling). Other errors, and the last one, are thrown.
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
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
  }
}

/** Whether a request failed because the server throttles (HTTP 429). */
export const isThrottled = (error: unknown) =>
  error instanceof Error && /\bHTTP 429\b/.test(error.message);

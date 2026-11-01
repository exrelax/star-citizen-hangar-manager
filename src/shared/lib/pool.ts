/**
 * Runs `task` for every input with at most `limit` tasks in flight. Results keep the input order.
 * Rejects with the first error and starts no further tasks after that.
 */
export async function mapWithConcurrency<T, R>(
  inputs: readonly T[],
  limit: number,
  task: (input: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(inputs.length);
  let next = 0;
  let failed = false;

  const worker = async () => {
    while (!failed && next < inputs.length) {
      const index = next++;
      try {
        results[index] = await task(inputs[index]!);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker));
  return results;
}

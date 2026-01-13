/**
 * Run tasks with concurrency limit
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length);
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < items.length; i++) {
    const index = i;
    const item = items[i];
    const promise = fn(item).then((result) => {
      results[index] = result;
    }).finally(() => {
      executing.delete(promise);
    });

    executing.add(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results as R[];
}

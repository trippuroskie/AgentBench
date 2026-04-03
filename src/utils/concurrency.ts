/**
 * Run async tasks with a concurrency limit using a semaphore pattern.
 * Executes up to `concurrency` items simultaneously.
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  executor: (item: T, index: number) => Promise<void>,
  shouldCancel: () => boolean,
): Promise<void> {
  const limit = Math.max(1, concurrency);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    while (nextIndex < items.length) {
      if (shouldCancel()) return;
      const index = nextIndex++;
      await executor(items[index], index);
    }
  }

  // Launch `limit` parallel workers
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(runNext());
  }

  await Promise.all(workers);
}

/** One interactive desktop/clipboard per worker. Failed jobs must not poison the queue. */
export class ExecutionQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

export const workerQueue = new ExecutionQueue();

/** Wait without keeping a cancelled command or its timer alive. */
export async function waitForDelay(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      reject(signal?.reason ?? new Error("Command cancelled"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

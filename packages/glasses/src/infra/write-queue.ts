export class BridgeTimeoutError extends Error {
  constructor(ms: number) {
    super(`bridge call timed out after ${ms} ms`)
    this.name = 'BridgeTimeoutError'
  }
}

export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BridgeTimeoutError(ms)), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

export type WriteQueue = <T>(task: () => Promise<T>) => Promise<T>

/**
 * Run glasses writes one at a time. Overlapping upgrades race and parallel image sends fail.
 * A timed-out task frees the queue, but its BLE call may still land later.
 */
export function createWriteQueue({ timeoutMs = 4000 }: { timeoutMs?: number } = {}): WriteQueue {
  let tail: Promise<unknown> = Promise.resolve()
  return task => {
    const run = tail.then(() => withTimeout(task(), timeoutMs))
    tail = run.catch(() => undefined)
    return run
  }
}

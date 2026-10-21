import type { GlassesBridge } from './bridge.ts'
import { withTimeout } from './write-queue.ts'

/** Anything with `parse(unknown): T`. A zod schema fits, and so does a hand-written guard. */
export type Codec<T> = { parse(raw: unknown): T }

export type KeySpec<T> = {
  /** Bump when the stored shape changes, and teach `migrate` the old shape. */
  version: number
  codec: Codec<T>
  fallback: T
  migrate?: (data: unknown, fromVersion: number) => unknown
}

type Envelope = { v: number; d: unknown }

/**
 * Typed, versioned app state in bridge storage. Browser localStorage is unreliable in this WebView.
 * Writes are debounced per key. Call `flush()` on foreground exit so nothing is lost.
 */
export function createStore(
  bridge: Pick<GlassesBridge, 'getLocalStorage' | 'setLocalStorage'>,
  opts: { debounceMs?: number; timeoutMs?: number; onError?: (key: string, error: unknown) => void } = {},
) {
  const { debounceMs = 500, timeoutMs = 4000, onError = () => {} } = opts
  const pending = new Map<string, { raw: string; timer: ReturnType<typeof setTimeout> }>()

  async function write(key: string, raw: string): Promise<void> {
    try {
      const ok = await withTimeout(bridge.setLocalStorage(key, raw), timeoutMs)
      if (!ok) onError(key, new Error('setLocalStorage returned false'))
    } catch (error) {
      onError(key, error)
    }
  }

  function key<T>(name: string, spec: KeySpec<T>) {
    async function get(): Promise<T> {
      const queued = pending.get(name)
      let raw: string
      try {
        raw = queued ? queued.raw : await withTimeout(bridge.getLocalStorage(name), timeoutMs)
      } catch (error) {
        onError(name, error)
        return spec.fallback
      }
      if (raw === '') return spec.fallback
      try {
        const env = JSON.parse(raw) as Envelope
        const data = env.v === spec.version ? env.d : spec.migrate ? spec.migrate(env.d, env.v) : undefined
        return data === undefined ? spec.fallback : spec.codec.parse(data)
      } catch (error) {
        onError(name, error)
        return spec.fallback
      }
    }

    function set(value: T): void {
      const raw = JSON.stringify({ v: spec.version, d: value } satisfies Envelope)
      clearTimeout(pending.get(name)?.timer)
      pending.set(name, { raw, timer: setTimeout(() => void flushKey(name), debounceMs) })
    }

    return { get, set }
  }

  async function flushKey(name: string): Promise<void> {
    const p = pending.get(name)
    if (!p) return
    clearTimeout(p.timer)
    pending.delete(name)
    await write(name, p.raw)
  }

  /** Write every pending value now. */
  async function flush(): Promise<void> {
    await Promise.all([...pending.keys()].map(flushKey))
  }

  return { key, flush }
}

export type Store = ReturnType<typeof createStore>

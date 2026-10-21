import { afterEach, describe, expect, it, vi } from 'vitest'
import { BridgeTimeoutError, createWriteQueue } from '../src/infra/write-queue.ts'

const later = <T>(value: T, ms: number) => new Promise<T>(r => setTimeout(() => r(value), ms))

afterEach(() => vi.useRealTimers())

describe('createWriteQueue', () => {
  it('runs tasks one at a time, in order', async () => {
    const enqueue = createWriteQueue()
    const log: string[] = []
    const task = (name: string, ms: number) => () => {
      log.push(`start ${name}`)
      return later(name, ms).then(v => (log.push(`end ${name}`), v))
    }
    const results = await Promise.all([enqueue(task('a', 20)), enqueue(task('b', 1))])
    expect(results).toEqual(['a', 'b'])
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b'])
  })

  it('times out a hung call and keeps the queue moving', async () => {
    vi.useFakeTimers()
    const enqueue = createWriteQueue({ timeoutMs: 100 })
    const hung = enqueue(() => new Promise(() => {}))
    const next = enqueue(async () => 'ok')
    const hungResult = expect(hung).rejects.toBeInstanceOf(BridgeTimeoutError)
    await vi.advanceTimersByTimeAsync(100)
    await hungResult
    await expect(next).resolves.toBe('ok')
  })

  it('keeps going after a task throws', async () => {
    const enqueue = createWriteQueue()
    const failed = enqueue(async () => { throw new Error('boom') })
    await expect(failed).rejects.toThrow('boom')
    await expect(enqueue(async () => 1)).resolves.toBe(1)
  })
})

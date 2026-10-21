import type { Intent } from '../domain/events.ts'
import type { GlassesBridge } from './bridge.ts'

type Handler = () => void | Promise<void>

/**
 * Foreground events and exit, handled once. An OS overlay fires ENTER and EXIT while the page stays mounted
 * (docs/findings/lifecycle.md#h7), so every foreground event is a checkpoint: cheap and harmless to repeat.
 */
export function createLifecycle(bridge: Pick<GlassesBridge, 'shutDownPageContainer'>) {
  let exited = false
  const checkpoints: Handler[] = []
  const exits: Handler[] = []

  const run = (list: Handler[]) => Promise.allSettled(list.map(h => h())).then(() => undefined)
  const register = (list: Handler[]) => (h: Handler) => {
    list.push(h)
    return () => void list.splice(list.indexOf(h), 1)
  }

  /** Feed every intent through here first. Returns true when the intent was a lifecycle event. */
  function handle(intent: Intent): boolean {
    if (intent.kind === 'foregroundEnter' || intent.kind === 'foregroundExit') {
      if (!exited) void run(checkpoints)
      return true
    }
    if (intent.kind === 'exit') {
      if (!exited) { exited = true; void run(exits) }
      return true
    }
    return false
  }

  /**
   * Ask to leave from the root page: the OS shows its confirm dialog. Do not clean up here,
   * because the user can cancel. Clean-up runs on the exit event instead.
   */
  function requestExit(): Promise<boolean> {
    return bridge.shutDownPageContainer(1)
  }

  return {
    handle, requestExit,
    /** Runs on every foreground event: save state, re-arm sockets, audio and location. */
    onCheckpoint: register(checkpoints),
    /** Runs once, on the system or abnormal exit event. */
    onExit: register(exits),
    get exited() { return exited },
  }
}

export type Lifecycle = ReturnType<typeof createLifecycle>

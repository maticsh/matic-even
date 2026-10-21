import { ImageRawDataUpdate, ImageRawDataUpdateResult, StartUpPageCreateResult } from '@evenrealities/even_hub_sdk'
import { textUpgrade, type BuiltPage } from '../domain/page.ts'
import { checkText } from '../domain/budget.ts'
import type { GlassesBridge } from './bridge.ts'
import { createWriteQueue, type WriteQueue } from './write-queue.ts'

export type RenderError = { op: 'mount' | 'text' | 'image' | 'queue'; name?: string; error: unknown }

type ImageData = NonNullable<ImageRawDataUpdate['imageData']>

/**
 * All glasses writes for one app. Writes run one at a time through the queue.
 * Text and images are latest-wins per container: a burst of updates collapses into one write,
 * and text that has not changed is never sent.
 */
export function createRenderer(bridge: GlassesBridge, opts: { queue?: WriteQueue; onError?: (e: RenderError) => void } = {}) {
  const enqueue = opts.queue ?? createWriteQueue()
  const report = opts.onError ?? (() => {})
  let page: BuiltPage | null = null
  let created = false
  const sent = new Map<string, { content: string; textColor?: number }>()
  const pendingText = new Map<string, { content: string; textColor?: number }>()
  const pendingImage = new Map<string, ImageData>()
  let idle: Promise<unknown> = Promise.resolve()

  const track = <T>(p: Promise<T>) => {
    idle = Promise.allSettled([idle, p])
    return p
  }

  /**
   * Show a page. The first call creates the startup page; later calls rebuild. If the create is
   * refused, the glasses may still hold a page from before the WebView reloaded (a dev reload, or
   * Android reclaiming the WebView), so it falls back to a rebuild.
   */
  function mount(next: BuiltPage): Promise<boolean> {
    pendingText.clear()
    pendingImage.clear()
    return track(enqueue(async () => {
      page = next
      sent.clear()
      for (const t of next.create.textObject ?? []) sent.set(t.containerName!, { content: t.content ?? '', textColor: t.textColor })
      const ok = created
        ? await bridge.rebuildPageContainer(next.rebuild)
        : (await bridge.createStartUpPageContainer(next.create)) === StartUpPageCreateResult.success
          || await bridge.rebuildPageContainer(next.rebuild)
      if (ok) created = true
      else report({ op: 'mount', error: new Error('page rejected') })
      return ok
    }).catch(error => (report({ op: 'mount', error }), false)))
  }

  function text(name: string, content: string, textColor?: number): void {
    const queued = pendingText.get(name)
    // Latest content wins. An unset colour keeps the colour still queued (docs/findings/display.md#h1).
    pendingText.set(name, { content, textColor: textColor ?? queued?.textColor })
    schedule()
  }

  function image(name: string, imageData: ImageData): void {
    pendingImage.set(name, imageData)
    schedule()
  }

  // One write per queue turn, text before images, so text waits for at most the image in flight.
  // Images go in the order they were first queued.
  let pumpQueued = false
  function schedule(): void {
    if (pumpQueued) return
    pumpQueued = true
    void track(enqueue(async () => {
      pumpQueued = false
      await sendOne()
      if (pendingText.size || pendingImage.size) schedule()
    }).catch(error => {
      // A timed-out write frees the queue. Keep pumping whatever is still waiting.
      report({ op: 'queue', error })
      if (pendingText.size || pendingImage.size) schedule()
    }))
  }

  async function sendOne(): Promise<void> {
    const [textName, nextText] = pendingText.entries().next().value ?? []
    if (textName !== undefined && nextText) {
      pendingText.delete(textName)
      return sendText(textName, nextText).catch(error => report({ op: 'text', name: textName, error }))
    }
    const [imageName, data] = pendingImage.entries().next().value ?? []
    if (imageName !== undefined && data !== undefined) {
      pendingImage.delete(imageName)
      return sendImage(imageName, data).catch(error => report({ op: 'image', name: imageName, error }))
    }
  }

  async function sendText(name: string, next: { content: string; textColor?: number }): Promise<void> {
    if (!page) return
    const prev = sent.get(name)
    const color = next.textColor ?? prev?.textColor
    if (prev && prev.content === next.content && prev.textColor === color) return
    const issues = checkText(next.content, 'upgrade')
    if (issues.some(i => i.kind === 'tooManyChars')) throw new Error(`text too long: ${JSON.stringify(issues)}`)
    const ok = await bridge.textContainerUpgrade(textUpgrade(page, name, next.content, next.textColor))
    if (!ok) throw new Error('upgrade rejected')
    sent.set(name, { content: next.content, textColor: color })
  }

  async function sendImage(name: string, data: ImageData): Promise<void> {
    const ref = page?.refs[name]
    if (!ref) return
    const result = await bridge.updateImageRawData(new ImageRawDataUpdate({ ...ref, imageData: data }))
    if (result !== ImageRawDataUpdateResult.success) throw new Error(`image ${result}`)
  }

  /** Resolves once every write queued so far has settled. */
  async function flush(): Promise<void> {
    let seen: Promise<unknown>
    do {
      seen = idle
      await seen
    } while (seen !== idle)
  }

  return { mount, text, image, flush }
}

export type Renderer = ReturnType<typeof createRenderer>

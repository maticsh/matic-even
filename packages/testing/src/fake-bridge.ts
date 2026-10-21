import {
  DeviceConnectType, DeviceStatus, ImageRawDataUpdateResult, OsEventTypeList, StartUpPageCreateResult,
  formatEvenHubPageContainerValidationError, utf8ByteLength, validateEvenHubPageContainer,
  type CreateStartUpPageContainer, type EvenHubEvent, type ImageRawDataUpdate, type RebuildPageContainer,
  type TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { LIMITS, type GlassesBridge } from '@maticsh/glasses'

type Payload = CreateStartUpPageContainer | RebuildPageContainer
type Listener<T> = (value: T) => void

export type BridgeCall = { method: string; arg?: unknown }

/**
 * An in-memory glasses bridge for unit tests. It records every call, keeps the page and text
 * state, and checks each payload the way the SDK and firmware would. Where the device fails
 * silently, the fake records a violation, so `assertNoViolations()` turns silent bugs into loud tests.
 */
export class FakeBridge implements GlassesBridge {
  readonly calls: BridgeCall[] = []
  readonly violations: string[] = []
  readonly storage = new Map<string, string>()
  page: Payload | null = null
  readonly texts = new Map<string, { content: string; textColor?: number }>()
  readonly images = new Map<string, NonNullable<ImageRawDataUpdate['imageData']>>()
  shutDownRequests: number[] = []
  audioOpen = false
  /** IMU reporting as the app last set it: off, or on at a pace. */
  imu: { open: boolean; pace?: number } = { open: false }

  private created: boolean
  private imagesInFlight = 0
  private readonly eventListeners = new Set<Listener<EvenHubEvent>>()
  private readonly statusListeners = new Set<Listener<DeviceStatus>>()

  /**
   * `pageFromBefore`: the glasses still hold a page from before the WebView reloaded. Like the
   * simulator, they then refuse a new startup page, and a rebuild works.
   */
  private readonly opts: { imageLatencyMs?: number; pageFromBefore?: boolean }

  constructor(opts: { imageLatencyMs?: number; pageFromBefore?: boolean } = {}) {
    this.opts = opts
    this.created = opts.pageFromBefore ?? false
  }

  private violate(message: string): void {
    this.violations.push(message)
  }

  assertNoViolations(): void {
    if (this.violations.length) throw new Error(`bridge violations:\n- ${this.violations.join('\n- ')}`)
  }

  private checkPayload(p: Payload): string[] {
    const issues: string[] = []
    const sdk = validateEvenHubPageContainer(p)
    if (!sdk.valid) issues.push(formatEvenHubPageContainerValidationError(sdk))
    const text = p.textObject ?? [], list = p.listObject ?? [], image = p.imageObject ?? []
    const all = [...text, ...list, ...image]
    if (p.containerTotalNum !== all.length) issues.push(`containerTotalNum ${p.containerTotalNum} != ${all.length}`)
    if (all.length > LIMITS.containers || text.length + list.length > LIMITS.textAndList || image.length > LIMITS.images) issues.push('too many containers')
    const captures = [...text, ...list].filter(c => c.isEventCapture === 1).length
    if (captures !== 1) issues.push(`expected exactly one capture container, found ${captures}`)
    const names = all.map(c => c.containerName ?? '')
    if (new Set(names).size !== names.length) issues.push('duplicate containerName')
    if (names.some(n => !n || utf8ByteLength(n) > LIMITS.containerNameBytes)) issues.push(`containerName must be 1-${LIMITS.containerNameBytes} bytes`)
    const ids = all.map(c => c.containerID)
    if (new Set(ids).size !== ids.length) issues.push('duplicate containerID')
    for (const t of text) if ([...(t.content ?? '')].length > LIMITS.createChars) issues.push(`"${t.containerName}" content over ${LIMITS.createChars} chars`)
    return issues
  }

  private applyPage(p: Payload): void {
    this.page = p
    this.texts.clear()
    this.images.clear()
    for (const t of p.textObject ?? []) this.texts.set(t.containerName!, { content: t.content ?? '', textColor: t.textColor })
  }

  async createStartUpPageContainer(c: CreateStartUpPageContainer): Promise<StartUpPageCreateResult> {
    this.calls.push({ method: 'createStartUpPageContainer', arg: c })
    if (this.created && this.opts.pageFromBefore) return StartUpPageCreateResult.invalid
    if (this.created) this.violate('createStartUpPageContainer called twice; use rebuildPageContainer')
    const issues = this.checkPayload(c)
    if (issues.length) {
      issues.forEach(i => this.violate(`create: ${i}`))
      return StartUpPageCreateResult.invalid
    }
    this.created = true
    this.applyPage(c)
    return StartUpPageCreateResult.success
  }

  async rebuildPageContainer(c: RebuildPageContainer): Promise<boolean> {
    this.calls.push({ method: 'rebuildPageContainer', arg: c })
    if (!this.created) this.violate('rebuildPageContainer before createStartUpPageContainer')
    const issues = this.checkPayload(c)
    if (issues.length) {
      issues.forEach(i => this.violate(`rebuild: ${i}`))
      return false
    }
    this.applyPage(c)
    return true
  }

  async textContainerUpgrade(u: TextContainerUpgrade): Promise<boolean> {
    this.calls.push({ method: 'textContainerUpgrade', arg: u })
    const match = (this.page?.textObject ?? []).find(t => t.containerID === u.containerID && t.containerName === u.containerName)
    if (!match) {
      this.violate(`textContainerUpgrade for unknown container ${u.containerID}/"${u.containerName}" (no-op on device)`)
      return false
    }
    if ([...(u.content ?? '')].length > LIMITS.upgradeChars) {
      this.violate(`textContainerUpgrade "${u.containerName}" over ${LIMITS.upgradeChars} chars`)
      return false
    }
    const prev = this.texts.get(u.containerName!)
    this.texts.set(u.containerName!, { content: u.content ?? '', textColor: u.textColor ?? prev?.textColor })
    return true
  }

  async updateImageRawData(d: ImageRawDataUpdate): Promise<ImageRawDataUpdateResult> {
    this.calls.push({ method: 'updateImageRawData', arg: d })
    const match = (this.page?.imageObject ?? []).find(i => i.containerID === d.containerID && i.containerName === d.containerName)
    if (!match) {
      this.violate(`updateImageRawData for unknown container ${d.containerID}/"${d.containerName}"`)
      return ImageRawDataUpdateResult.imageException
    }
    if (this.imagesInFlight > 0) {
      this.violate('parallel updateImageRawData; keep one image send in flight')
      return ImageRawDataUpdateResult.sendFailed
    }
    this.imagesInFlight++
    try {
      // No timer unless a latency is asked for, so tests on fake timers never stall on an image send.
      const ms = this.opts.imageLatencyMs
      await (ms ? new Promise(r => setTimeout(r, ms)) : Promise.resolve())
      this.images.set(d.containerName!, d.imageData!)
      return ImageRawDataUpdateResult.success
    } finally {
      this.imagesInFlight--
    }
  }

  async shutDownPageContainer(exitMode?: number): Promise<boolean> {
    this.calls.push({ method: 'shutDownPageContainer', arg: exitMode })
    this.shutDownRequests.push(exitMode ?? 0)
    return true
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.calls.push({ method: 'setLocalStorage', arg: { key, value } })
    this.storage.set(key, value)
    return true
  }

  async getLocalStorage(key: string): Promise<string> {
    this.calls.push({ method: 'getLocalStorage', arg: key })
    return this.storage.get(key) ?? ''
  }

  async audioControl(isOpen: boolean): Promise<boolean> {
    this.calls.push({ method: 'audioControl', arg: isOpen })
    if (isOpen && !this.created) {
      this.violate('audioControl before createStartUpPageContainer')
      return false
    }
    this.audioOpen = isOpen
    return true
  }

  async imuControl(isOpen: boolean, reportFrq?: number): Promise<boolean> {
    this.calls.push({ method: 'imuControl', arg: { isOpen, reportFrq } })
    if (isOpen && !this.created) {
      this.violate('imuControl before createStartUpPageContainer')
      return false
    }
    this.imu = { open: isOpen, ...(isOpen && { pace: reportFrq ?? 100 }) }
    return true
  }

  onEvenHubEvent(cb: Listener<EvenHubEvent>): () => void {
    this.eventListeners.add(cb)
    return () => void this.eventListeners.delete(cb)
  }

  onDeviceStatusChanged(cb: Listener<DeviceStatus>): () => void {
    this.statusListeners.add(cb)
    return () => void this.statusListeners.delete(cb)
  }

  // Driving the fake

  /** Push a raw event, shaped as the device would send it (zero values omitted). */
  emit(event: EvenHubEvent): void {
    for (const l of this.eventListeners) l(event)
  }

  private sys(eventType?: OsEventTypeList, eventSource = 1): void {
    this.emit({ sysEvent: { ...(eventType !== undefined && { eventType }), eventSource } } as EvenHubEvent)
  }

  /** A tap, as the device sends it: no eventType, because CLICK_EVENT is 0. */
  tap(): void { this.sys() }
  doubleTap(): void { this.sys(OsEventTypeList.DOUBLE_CLICK_EVENT) }
  swipe(dir: 'up' | 'down'): void {
    const eventType = dir === 'up' ? OsEventTypeList.SCROLL_TOP_EVENT : OsEventTypeList.SCROLL_BOTTOM_EVENT
    this.emit({ textEvent: { eventType } } as EvenHubEvent)
  }
  hold(): void { this.sys(OsEventTypeList.LONG_PRESS_EVENT) }
  release(): void { this.sys(OsEventTypeList.LONG_PRESS_RELEASE_EVENT) }
  /** One IMU sample, as the device sends it: zero axes omitted. Ignored while IMU reporting is off. */
  imuSample(x: number, y: number, z: number): void {
    if (!this.imu.open) return
    const imuData = Object.fromEntries(Object.entries({ x, y, z }).filter(([, v]) => v !== 0))
    this.emit({ sysEvent: { eventType: OsEventTypeList.IMU_DATA_REPORT, imuData } } as unknown as EvenHubEvent)
  }
  menu(itemID: number): void { this.emit({ menuItemClickEvent: { itemID } } as EvenHubEvent) }
  foreground(state: 'enter' | 'exit'): void {
    this.sys(state === 'enter' ? OsEventTypeList.FOREGROUND_ENTER_EVENT : OsEventTypeList.FOREGROUND_EXIT_EVENT)
  }
  systemExit(): void { this.sys(OsEventTypeList.SYSTEM_EXIT_EVENT) }
  abnormalExit(): void { this.sys(OsEventTypeList.ABNORMAL_EXIT_EVENT) }

  status(s: { isWearing?: boolean; batteryLevel?: number; isCharging?: boolean; isInCase?: boolean }): void {
    const status = new DeviceStatus({ sn: 'FAKE', connectType: DeviceConnectType.Connected, ...s })
    for (const l of this.statusListeners) l(status)
  }

  /** Shorthand for the latest content of a text container. */
  text(name: string): string | undefined {
    return this.texts.get(name)?.content
  }

  /** The labels of the current page's menu. */
  get menuLabels(): string[] {
    return (this.page?.menuObject?.menuItems ?? []).map(m => m.itemName ?? '')
  }
}

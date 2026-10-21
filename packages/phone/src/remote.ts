/**
 * DEV ONLY. A remote under the preview: tap, swipe up and swipe down as phone buttons, plus the arrow
 * keys and the space bar on a desktop. It sends the same gestures the ring and temple send, so the app
 * runs its real input path. It is for development only: import it from `@maticsh/phone/dev` in a
 * dev-only page, so the production build never reaches it.
 */
import './remote.css'
import { GESTURE_ICON, pixelText, pixelTextWidth, type Gesture } from '@maticsh/glasses'
import type { Frame } from './frame.ts'
import { gridPath, type GlassScreen } from './glass.ts'
import { esc } from './html.ts'

export type RemoteGesture = 'tap' | 'swipeUp' | 'swipeDown'
export type RemoteButton = { gesture: RemoteGesture; label: string; enabled: boolean }

/** The remote's height inside the tray, margin included, for the pin's measurements. */
export const REMOTE_HEIGHT = 54

/**
 * Three buttons from the glass's own bar: the tap action's verb, and the swipe action's verb twice,
 * up and down. A gesture the bar leaves out does nothing now, so its button is disabled.
 */
export function remoteButtons(bar: GlassScreen['bar']): RemoteButton[] {
  const find = (g: Gesture) => bar.find(b => b.gesture === g)
  const tap = find('tap')
  const up = find('swipeUp') ?? find('swipe')
  const down = find('swipeDown') ?? find('swipe')
  return [
    { gesture: 'tap', label: tap?.label ?? 'tap', enabled: !!tap },
    { gesture: 'swipeUp', label: up?.label ?? 'swipe', enabled: !!up },
    { gesture: 'swipeDown', label: down?.label ?? 'swipe', enabled: !!down },
  ]
}

const glyph = (ch: string) => {
  const g = pixelText(ch, { scale: 1 })
  return `<svg width="${pixelTextWidth(ch, 1) * 2}" height="16" viewBox="0 0 ${pixelTextWidth(ch, 1) * 2} 16" aria-hidden="true"><path d="${gridPath(g, 2)}"/></svg>`
}

const ARIA: Record<RemoteGesture, string> = { tap: 'Tap', swipeUp: 'Swipe up', swipeDown: 'Swipe down' }

export function remoteHtml(buttons: readonly RemoteButton[]): string {
  return `<div class="remote" role="group" aria-label="Remote for the glasses">`
    + buttons.map(b => `<button type="button" class="rb" data-gesture="${b.gesture}" aria-label="${ARIA[b.gesture]}: ${esc(b.label)}"${b.enabled ? '' : ' disabled'}>`
      + `<span>${esc(b.label)}</span>${glyph(GESTURE_ICON[b.gesture])}</button>`).join('')
    + `</div>`
}

const KEYS: Record<string, RemoteGesture> = { ArrowUp: 'swipeUp', ArrowDown: 'swipeDown', ' ': 'tap' }

/** Put the remote in the frame's tray. `send` delivers a gesture the way the glasses would. */
export function mountRemote(frame: Frame, send: (g: RemoteGesture) => void): { update(screen: GlassScreen): void } {
  const foot = frame.setFoot(remoteHtml(remoteButtons([])), REMOTE_HEIGHT)
  const flash = (g: RemoteGesture) => {
    const b = foot.querySelector(`[data-gesture="${g}"]`)
    b?.classList.add('hit')
    setTimeout(() => b?.classList.remove('hit'), 140)
  }
  foot.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-gesture]')
    if (b && !b.disabled) send(b.dataset.gesture as RemoteGesture)
  })
  document.addEventListener('keydown', e => {
    const g = KEYS[e.key]
    const t = e.target as HTMLElement
    // Typing, and buttons that own the space bar, keep their keys.
    if (!g || t.closest('input, textarea, select') || (e.key === ' ' && t.closest('button'))) return
    e.preventDefault()
    flash(g)
    send(g)
  })
  return {
    update(screen) {
      foot.innerHTML = remoteHtml(remoteButtons(screen.bar))
    },
  }
}

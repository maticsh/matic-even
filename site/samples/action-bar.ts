import {
  GESTURE_ICON, actionBar, pixelText, pixelTextWidth, type Keymap,
} from '@maticsh/glasses'

const keys: Keymap<() => void> = [
  { gesture: 'tap', label: 'tick', action: () => {} },
  { gesture: 'swipe', label: 'move', action: () => {} },
  { gesture: 'doubleTap', label: 'exit', action: () => {} },
]

// The line comes from the same table the gestures resolve against.
const line = actionBar(keys, {
  widthPx: 288,
  glyphs: GESTURE_ICON,
  measure: s => pixelTextWidth(s),
})

export const bar = pixelText(line, { scale: 2 })

// Every character in the pixel font, at scale 1.
const chars = 'abcdefghijklm nopqrstuvwxyz 0123456789 ●▲▼⬬★▶'
export const font = pixelText(chars, { scale: 1 })

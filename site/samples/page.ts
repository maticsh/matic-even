import {
  GESTURE_ICON, actionBar, buildPage, corner, fitLines,
  pixelText, pixelTextWidth, pixels,
} from '@maticsh/glasses'

const note = 'Parcel at the front desk until six. '
  + 'Call the garage about the brakes before noon tomorrow.'

export const page = buildPage({
  containers: [
    { kind: 'image', name: 'clock',
      box: { x: 16, y: 16, width: 240, height: 60 } },
    { kind: 'text', name: 'day',
      box: corner(200, 32, 'tr', 16), content: 'tue · oct 20' },
    { kind: 'text', name: 'note', capture: true,
      box: { x: 16, y: 96, width: 544, height: 60 },
      content: fitLines(note, 544, 2) },
    { kind: 'text', name: 'next',
      box: { x: 16, y: 170, width: 300, height: 72 },
      border: { width: 1, color: 15, radius: 6 }, padding: 6,
      content: 'next 10:15\nstand-up, room 4' },
    { kind: 'image', name: 'bar',
      box: { x: 16, y: 256, width: 288, height: 20 } },
  ],
})

// Grids for the two image containers. The app encodes them to PNG
// in the browser and sends them once the page is up.
const line = actionBar([
  { gesture: 'tap', label: 'done', action: null },
  { gesture: 'swipe', label: 'scroll', action: null },
], {
  widthPx: 288,
  glyphs: GESTURE_ICON,
  measure: s => pixelTextWidth(s),
})

export const images = {
  clock: pixels.dotText('09:41', { dot: 6, gap: 2 }),
  bar: pixelText(line, { scale: 2 }),
}

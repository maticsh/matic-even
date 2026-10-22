import {
  GESTURE_ICON, actionBar, buildPage, listPage, pixelTextWidth,
} from '@maticsh/glasses'

const bar = actionBar([
  { gesture: 'tap', label: 'open', action: null },
  { gesture: 'swipe', label: 'move', action: null },
], { widthPx: 288, glyphs: GESTURE_ICON, measure: s => pixelTextWidth(s) })

export const preset = listPage({
  title: 'reading list',
  items: [
    'the long view on cities',
    'notes from a slow trip along the coast road, and the towns between',
    'how bridges stay up',
    'a short history of maps',
  ],
  selected: 1,
  bar: { text: bar },
})

// Text goes in with the page. The bar grid follows once it is up.
export const page = buildPage(preset.spec)
export const images = preset.images

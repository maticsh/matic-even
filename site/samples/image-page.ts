import { buildPage, imagePage, pixels } from '@maticsh/glasses'

export const preset = imagePage({
  width: 240, height: 96, caption: 'tide at the pier, next 24 h',
})
export const page = buildPage(preset.spec)

// You draw the image at the size the page gave it, then send it.
const { width, height } = page.boxes.image!
const tide = [5, 7, 9, 10, 10, 9, 7, 5, 3, 2, 1, 1,
  2, 3, 5, 7, 9, 10, 10, 9, 7, 5, 3, 2]
const chart = pixels.grid(width, height)
tide.forEach((t, i) => {
  const h = Math.round((t / 10) * (height - 4))
  // This hour at full brightness, the rest at level 6 of 15.
  pixels.fillRect(chart, i * 10, height - h, 8, h, i === 0 ? 15 : 6)
})
export const images = { image: chart }

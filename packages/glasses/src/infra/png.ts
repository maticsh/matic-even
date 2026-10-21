/**
 * Grids to images in the browser (canvas). PNG bytes for the glasses, and data URLs for phone pages.
 */
import type { Grid } from '../domain/pixels.ts'

/** Grid levels 0-15 to a greyscale PNG via canvas. The SDK converts PNG for the glasses. */
export async function encodePng(g: Grid): Promise<Uint8Array> {
  const c = document.createElement('canvas')
  c.width = g.w
  c.height = g.h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(g.w, g.h)
  g.px.forEach((level, i) => {
    const v = Math.round((level / 15) * 255)
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  })
  ctx.putImageData(img, 0, 0)
  const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Light mode, as the Even app shows glasses content on the phone: lit pixels become dark greys on a
 * transparent background (level 15 is near-black, level 1 a pale grey).
 */
export function gridToInkDataUrl(g: Grid, scale: number): string {
  const c = document.createElement('canvas')
  c.width = g.w * scale
  c.height = g.h * scale
  const ctx = c.getContext('2d')!
  g.px.forEach((level, i) => {
    if (!level) return
    const v = Math.round(222 - (level / 15) * (222 - 30))
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`
    ctx.fillRect((i % g.w) * scale, Math.floor(i / g.w) * scale, scale, scale)
  })
  return c.toDataURL('image/png')
}

/** The same grid as a green-on-black data URL, for dev previews of the glasses look. */
export function gridToDataUrl(g: Grid, scale: number): string {
  const c = document.createElement('canvas')
  c.width = g.w * scale
  c.height = g.h * scale
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, c.width, c.height)
  g.px.forEach((level, i) => {
    if (!level) return
    ctx.fillStyle = `rgba(80, 255, 80, ${level / 15})`
    ctx.fillRect((i % g.w) * scale, Math.floor(i / g.w) * scale, scale, scale)
  })
  return c.toDataURL('image/png')
}

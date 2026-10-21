/**
 * A 144 x 144 test image: a frame, a pixel tree and a timestamp tick, as PNG bytes.
 * The SDK converts PNG to the glasses format. The tick moves one cell per send, so a frame that
 * landed is always visible as a change.
 */
export async function testPattern(n: number): Promise<Uint8Array> {
  const c = document.createElement('canvas')
  c.width = 144
  c.height = 144
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 144, 144)
  g.strokeStyle = '#fff'
  g.lineWidth = 2
  g.strokeRect(1, 1, 142, 142)

  // A blocky tree, drawn in 8 px cells.
  g.fillStyle = '#fff'
  const cell = (x: number, y: number) => g.fillRect(x * 8, y * 8, 8, 8)
  for (let row = 0; row < 6; row++) {
    for (let col = 9 - row; col <= 8 + row; col++) cell(col, 3 + row)
  }
  for (let y = 9; y < 14; y++) cell(8, y), cell(9, y)

  // Grey levels along the bottom: 16 steps, to check the 4-bit greyscale on glass.
  for (let i = 0; i < 16; i++) {
    const v = Math.round((i / 15) * 255)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(8 + i * 8, 124, 8, 12)
  }

  // A tick that moves one cell per send, so every send differs from the last.
  g.fillStyle = '#fff'
  g.fillRect(8 + (n % 16) * 8, 116, 8, 4)

  const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

/** A 48 x 48 corner sprite: a small tree in 6 px cells, or an all-black frame when `on` is false. */
export async function sprite(on: boolean): Promise<Uint8Array> {
  const c = document.createElement('canvas')
  c.width = 48
  c.height = 48
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 48, 48)
  if (on) {
    g.fillStyle = '#fff'
    const cell = (x: number, y: number) => g.fillRect(x * 6, y * 6, 6, 6)
    for (let row = 0; row < 4; row++) for (let col = 3 - row; col <= 4 + row; col++) cell(col, 1 + row)
    cell(3, 5), cell(4, 5), cell(3, 6), cell(4, 6)
  }
  const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Lines of text at several pixel sizes, drawn by the phone's own font engine (which shapes Hindi
 * properly) and sent as an image. Each line starts with its size in px.
 */
export async function textSizes(text: string, sizes: readonly number[], w: number, h: number, leading: number): Promise<Uint8Array> {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#fff'
  g.textBaseline = 'top'
  let y = 2
  for (const size of sizes) {
    g.font = `${size}px sans-serif`
    g.fillText(`${size} ${text}`, 4, y)
    y += Math.round(size * leading)
  }
  const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

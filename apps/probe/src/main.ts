import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { run } from './probe.ts'
import { sprite, testPattern, textSizes } from './pattern.ts'
import { CJK_SAMPLE, CJK_SIZES, HINDI_SAMPLE, HINDI_SIZES } from './scripts.ts'
import { CSV_HEADER } from './sense.ts'

const bridge = await waitForEvenAppBridge()
const out = document.getElementById('status')!

// One log file per launch on the dev server (vite.config.ts): logs/<session>.csv.
const session = `sense-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`
let first = true

await run(bridge, {
  now: () => Date.now(),
  every: (ms, fn) => void setInterval(fn, ms),
  makeImage: testPattern,
  makeSprite: sprite,
  makeScript: script => script === 'hindi'
    ? textSizes(HINDI_SAMPLE, HINDI_SIZES, 288, 144, 1.5)
    : textSizes(CJK_SAMPLE, CJK_SIZES, 288, 106, 1.25),
  mirror: text => { out.textContent = text },
  ship: async csv => {
    const body = `${first ? `${CSV_HEADER}\n` : ''}${csv}\n`
    const res = await fetch(`/__probe/log?session=${session}`, { method: 'POST', body })
    if (res.ok) first = false
    return res.ok
  },
})

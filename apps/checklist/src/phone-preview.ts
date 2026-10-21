// DEV ONLY: the phone page with the real app behind it, on FakeBridge from @maticsh/testing: no Even
// app, no glasses. For design work and screenshots. It has its own storage namespace.
//   ?remote  tap and swipe buttons under the preview, plus the arrow keys and the space bar
//   ?ui      the Kit view: every shell part in each variant
//   ?tab=lists|items|settings  ?align=centre  ?hide  ?empty  ?done   start states for screenshots
// Vite builds index.html only, so nothing this file imports reaches dist.
import { FakeBridge } from '@maticsh/testing'
import { encodePng } from '@maticsh/glasses'
import { run, type App } from './app/glasses.ts'
import { mountPhone } from './infra/phone.ts'
import { mountRemote } from '@maticsh/phone/dev'
import { mountKitView } from '@maticsh/phone/dev'

const params = new URLSearchParams(location.search)
const root = document.getElementById('app')!
const bridge = new FakeBridge()

let app: App | undefined
const phone = mountPhone(root, () => app!)
const remote = params.has('remote')
  ? mountRemote(phone.frame, g => (g === 'tap' ? bridge.tap() : bridge.swipe(g === 'swipeUp' ? 'up' : 'down')))
  : null

app = await run(bridge, {
  now: Date.now,
  encode: encodePng,
  namespace: 'checklist.preview',
  onChange: v => { phone.update(v); remote?.update(v.screen) },
})

// Start states. A couple of ticks, so the preview shows both boxes.
const packing = app.state.lists[0]!
app.toggle(packing.id, packing.items[0]!.id)
app.toggle(packing.id, packing.items[1]!.id)
app.select(packing.id, packing.items[2]!.id)
if (params.get('align') === 'centre') app.setAlign('centre')
if (params.has('hide')) app.setHideTicked(true)
if (params.has('done')) for (const it of packing.items.slice(2)) app.toggle(packing.id, it.id)
if (params.has('empty')) for (const it of [...app.state.lists[2]!.items]) app.remove('bed', it.id)
if (params.has('empty')) app.show('bed')
const tab = params.get('tab')
if (tab) document.querySelector<HTMLButtonElement>(`nav.tabbar [data-arg="${tab}"]`)?.click()

if (params.has('ui')) mountKitView(root, app.view().screen)

Object.assign(window, { checklist: app, bridge })

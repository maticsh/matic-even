import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { encodePng } from '@maticsh/glasses'
import { run, type App } from './app/glasses.ts'
import { mountPhone } from './infra/phone.ts'

// Dev only: ?demo starts from the seed in its own storage, for simulator frames and store shots.
// Add &align=centre, &hide, &done (every Packing item ticked) or &empty (an empty list on the glass).
// It sits behind import.meta.env.DEV, so a production build drops it.
const params = new URLSearchParams(location.search)
const demo = import.meta.env.DEV && params.has('demo')

const bridge = await waitForEvenAppBridge()
let app: App | undefined
const phone = mountPhone(document.getElementById('app')!, () => app!)
app = await run(bridge, {
  now: Date.now,
  encode: encodePng,
  onChange: phone.update,
  namespace: demo ? `checklist.demo.${Date.now()}` : 'checklist',
})

if (demo) {
  const packing = app.state.lists[0]!
  if (params.get('align') === 'centre') app.setAlign('centre')
  if (params.has('hide')) app.setHideTicked(true)
  if (params.has('done')) for (const it of packing.items) app.toggle(packing.id, it.id)
  if (params.has('empty')) {
    for (const it of [...app.state.lists[2]!.items]) app.remove('bed', it.id)
    app.show('bed')
  }
}

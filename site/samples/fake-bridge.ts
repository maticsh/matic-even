import { buildPage } from '@maticsh/glasses'
import { FakeBridge } from '@maticsh/testing'

const bridge = new FakeBridge()
const page = buildPage({
  containers: [{
    kind: 'text', name: 'count', content: '0', capture: true,
    box: { x: 0, y: 0, width: 576, height: 288 },
  }],
})

await bridge.imuControl(true, 100) // before the page exists
await bridge.createStartUpPageContainer(page.create)
await bridge.createStartUpPageContainer(page.create) // a second one

// The glasses drop both with no error. The fake records them,
// so the test fails.
try {
  bridge.assertNoViolations()
} catch (e) {
  console.log((e as Error).message)
}

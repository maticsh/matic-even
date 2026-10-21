import { describe, expect, it } from 'vitest'
import { validateEvenHubPageContainer } from '@evenrealities/even_hub_sdk'
import { PageSpecError, buildPage, corner, strip, textUpgrade, type PageSpec } from '../src/domain/page.ts'

const ambient: PageSpec = {
  containers: [
    { kind: 'text', name: 'input', box: { x: 0, y: 0, width: 576, height: 288 }, content: ' ', capture: true },
    { kind: 'image', name: 'tree', box: corner(48, 48, 'bl', 8) },
    { kind: 'text', name: 'bar', box: strip(27, 'bottom'), content: '━━━━──', textColor: 1 },
  ],
  menu: [{ id: 1, label: 'Skip phase' }, { id: 2, label: 'Give up tree' }],
}

describe('buildPage', () => {
  it('builds create and rebuild payloads the SDK accepts', () => {
    const page = buildPage(ambient)
    expect(validateEvenHubPageContainer(page.create)).toEqual({ valid: true })
    expect(page.create.containerTotalNum).toBe(3)
    expect(page.create.textObject).toHaveLength(2)
    expect(page.create.imageObject).toHaveLength(1)
  })

  it('numbers IDs and z-order from 1 in draw order', () => {
    const page = buildPage(ambient)
    expect(page.refs).toEqual({
      input: { containerID: 1, containerName: 'input' },
      tree: { containerID: 2, containerName: 'tree' },
      bar: { containerID: 3, containerName: 'bar' },
    })
    expect(page.create.imageObject![0]!.zOrderIndex).toBe(2)
  })

  it('records each container box', () => {
    expect(buildPage(ambient).boxes.tree).toEqual(corner(48, 48, 'bl', 8))
  })

  it('puts the menu on rebuild too, so a rebuild never drops it', () => {
    const page = buildPage(ambient)
    expect(page.rebuild.menuObject?.menuItems?.map(m => m.itemName)).toEqual(['Skip phase', 'Give up tree'])
  })

  it('reports every problem at once', () => {
    const bad: PageSpec = {
      containers: [
        { kind: 'text', name: 'a-name-that-is-too-long', box: { x: 0, y: 0, width: 600, height: 20 }, content: 'ok ✓' },
        { kind: 'image', name: 'img', box: { x: 0, y: 0, width: 10, height: 10 } },
      ],
    }
    try {
      buildPage(bad)
      expect.unreachable()
    } catch (e) {
      const issues = (e as PageSpecError).issues.join('\n')
      expect(issues).toMatch(/1-16 bytes/)
      expect(issues).toMatch(/off screen/)
      expect(issues).toMatch(/20-288 wide/)
      expect(issues).toMatch(/missingGlyphs/)
      expect(issues).toMatch(/exactly one .* capture/)
    }
  })

  it('rejects two capture containers', () => {
    const two: PageSpec = {
      containers: [
        { kind: 'text', name: 'a', box: { x: 0, y: 0, width: 100, height: 30 }, content: 'a', capture: true },
        { kind: 'list', name: 'b', box: { x: 0, y: 40, width: 100, height: 100 }, items: ['x'], capture: true },
      ],
    }
    expect(() => buildPage(two)).toThrow(/found 2/)
  })

  it('makes upgrades that match the page exactly, and refuses unknown names', () => {
    const page = buildPage(ambient)
    expect(textUpgrade(page, 'bar', '━━──', 2)).toMatchObject({ containerID: 3, containerName: 'bar', content: '━━──', textColor: 2 })
    expect(() => textUpgrade(page, 'tree', 'x')).toThrow(/no text container/)
    expect(() => textUpgrade(page, 'nope', 'x')).toThrow(/no text container/)
  })
})

describe('layout helpers', () => {
  it('anchors boxes to corners and edges', () => {
    expect(corner(48, 48, 'br', 8)).toEqual({ x: 520, y: 232, width: 48, height: 48 })
    expect(strip(27, 'top')).toEqual({ x: 0, y: 0, width: 576, height: 27 })
  })
})

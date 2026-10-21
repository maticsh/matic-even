import {
  CreateStartUpPageContainer, ImageContainerProperty, ListContainerProperty, ListItemContainerProperty,
  MenuContainerProperty, MenuItemProperty, RebuildPageContainer, TextContainerProperty, TextContainerUpgrade,
  formatEvenHubPageContainerValidationError, utf8ByteLength, validateEvenHubPageContainer,
} from '@evenrealities/even_hub_sdk'
import { LIMITS, checkText } from './budget.ts'
import { SCREEN, type Box } from './fit.ts'

type Border = { width: number; color?: number; radius?: number }
type Common = { name: string; box: Box }

export type TextSpec = Common & {
  kind: 'text'; content: string; capture?: boolean; textColor?: number; border?: Border; padding?: number
}
export type ListSpec = Common & {
  kind: 'list'; items: string[]; capture?: boolean; selectBorder?: boolean; border?: Border; padding?: number
}
export type ImageSpec = Common & { kind: 'image' }
export type ContainerSpec = TextSpec | ListSpec | ImageSpec

/** A page as data. Container order is draw order: later containers draw in front. */
export type PageSpec = {
  containers: ContainerSpec[]
  /** Pass it on every page that should keep a menu. A page without one clears the menu on rebuild. */
  menu?: { id: number; label: string }[]
}

export type Ref = { containerID: number; containerName: string }

export type BuiltPage = {
  create: CreateStartUpPageContainer
  rebuild: RebuildPageContainer
  refs: Record<string, Ref>
  kinds: Record<string, ContainerSpec['kind']>
  /** Each container's box, so callers can check an image's size before sending it. */
  boxes: Record<string, Box>
}

export class PageSpecError extends Error {
  readonly issues: string[]
  constructor(issues: string[]) {
    super(`invalid page:\n- ${issues.join('\n- ')}`)
    this.name = 'PageSpecError'
    this.issues = issues
  }
}

function checkSpec(spec: PageSpec): string[] {
  const issues: string[] = []
  const { containers: cs } = spec
  const names = new Set<string>()
  for (const c of cs) {
    if (names.has(c.name)) issues.push(`duplicate name "${c.name}"`)
    names.add(c.name)
    if (!c.name || utf8ByteLength(c.name) > LIMITS.containerNameBytes) issues.push(`name "${c.name}" must be 1-${LIMITS.containerNameBytes} bytes`)
    const { x, y, width, height } = c.box
    if (x < 0 || y < 0 || x + width > SCREEN.width || y + height > SCREEN.height) issues.push(`"${c.name}" is off screen`)
    if (c.kind === 'image' && (width < 20 || width > 288 || height < 20 || height > 144)) {
      issues.push(`image "${c.name}" must be 20-288 wide and 20-144 tall`)
    }
    if (c.kind === 'text') {
      for (const i of checkText(c.content, 'create')) issues.push(`text "${c.name}": ${JSON.stringify(i)}`)
    }
    if (c.kind === 'list') {
      if (c.items.length < 1 || c.items.length > LIMITS.listItems) issues.push(`list "${c.name}" needs 1-${LIMITS.listItems} items`)
      for (const item of c.items) {
        if (utf8ByteLength(item) > LIMITS.listItemBytes) issues.push(`list "${c.name}" item over ${LIMITS.listItemBytes} bytes: "${item}"`)
      }
    }
  }
  const images = cs.filter(c => c.kind === 'image').length
  if (cs.length < 1 || cs.length > LIMITS.containers) issues.push(`a page holds 1-${LIMITS.containers} containers`)
  if (cs.length - images > LIMITS.textAndList) issues.push(`a page holds at most ${LIMITS.textAndList} text and list containers`)
  if (images > LIMITS.images) issues.push(`a page holds at most ${LIMITS.images} image containers`)
  const captures = cs.filter(c => c.kind !== 'image' && c.capture).length
  if (captures !== 1) issues.push(`exactly one text or list container must capture input (found ${captures})`)
  if (spec.menu && spec.menu.length > LIMITS.menuItems) issues.push(`a menu holds at most ${LIMITS.menuItems} items`)
  return issues
}

/**
 * Turn a spec into SDK payloads, or throw with every problem at once.
 * IDs and z-order start at 1, because protobuf drops zero values on the wire.
 */
export function buildPage(spec: PageSpec): BuiltPage {
  const issues = checkSpec(spec)
  if (issues.length) throw new PageSpecError(issues)

  const refs: Record<string, Ref> = {}
  const kinds: Record<string, ContainerSpec['kind']> = {}
  const boxes: Record<string, Box> = {}
  const textObject: TextContainerProperty[] = []
  const listObject: ListContainerProperty[] = []
  const imageObject: ImageContainerProperty[] = []

  spec.containers.forEach((c, i) => {
    const ref = { containerID: i + 1, containerName: c.name }
    refs[c.name] = ref
    kinds[c.name] = c.kind
    boxes[c.name] = c.box
    const base = {
      ...ref, zOrderIndex: i + 1,
      xPosition: c.box.x, yPosition: c.box.y, width: c.box.width, height: c.box.height,
    }
    if (c.kind === 'image') return void imageObject.push(new ImageContainerProperty(base))
    const frame = {
      isEventCapture: c.capture ? 1 : 0,
      borderWidth: c.border?.width ?? 0, borderColor: c.border?.color ?? 0, borderRadius: c.border?.radius ?? 0,
      paddingLength: c.padding ?? 0,
    }
    if (c.kind === 'text') {
      return void textObject.push(new TextContainerProperty({ ...base, ...frame, content: c.content, textColor: c.textColor }))
    }
    listObject.push(new ListContainerProperty({
      ...base, ...frame,
      itemContainer: new ListItemContainerProperty({
        itemCount: c.items.length, itemName: c.items, isItemSelectBorderEn: c.selectBorder === false ? 0 : 1,
      }),
    }))
  })

  const menuObject = spec.menu
    ? new MenuContainerProperty({ menuItems: spec.menu.map(m => new MenuItemProperty({ itemID: m.id, itemName: m.label })) })
    : undefined
  const payload = {
    containerTotalNum: spec.containers.length,
    ...(textObject.length && { textObject }),
    ...(listObject.length && { listObject }),
    ...(imageObject.length && { imageObject }),
    ...(menuObject && { menuObject }),
  }
  const sdk = validateEvenHubPageContainer(payload)
  if (!sdk.valid) throw new PageSpecError([formatEvenHubPageContainerValidationError(sdk)])

  return { create: new CreateStartUpPageContainer(payload), rebuild: new RebuildPageContainer(payload), refs, kinds, boxes }
}

/** A text upgrade whose ID and name match the page exactly. A mismatch would no-op silently. */
export function textUpgrade(page: BuiltPage, name: string, content: string, textColor?: number): TextContainerUpgrade {
  const ref = page.refs[name]
  if (!ref || page.kinds[name] !== 'text') throw new PageSpecError([`no text container "${name}" on this page`])
  return new TextContainerUpgrade({ ...ref, content, ...(textColor !== undefined && { textColor }) })
}

/** A box anchored to a screen corner, `margin` px in from both edges. */
export function corner(width: number, height: number, at: 'tl' | 'tr' | 'bl' | 'br', margin = 0): Box {
  const x = at[1] === 'l' ? margin : SCREEN.width - width - margin
  const y = at[0] === 't' ? margin : SCREEN.height - height - margin
  return { x, y, width, height }
}

/** A full-width strip along the top or bottom edge. */
export function strip(height: number, at: 'top' | 'bottom', margin = 0): Box {
  return { x: margin, y: at === 'top' ? margin : SCREEN.height - height - margin, width: SCREEN.width - 2 * margin, height }
}

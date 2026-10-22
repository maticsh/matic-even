import { buildPage, cardPage } from '@maticsh/glasses'

export const preset = cardPage({
  title: 'stand-up, room 4',
  body: 'Bring the numbers from last week and the launch plan. '
    + 'Keep it to fifteen minutes, so the room is free for the '
    + 'design review at half past. Coffee is in the kitchen on '
    + 'the second floor, and the projector remote is in the '
    + 'drawer under the screen.',
  progress: 0.35,
})

export const page = buildPage(preset.spec)
export const images = preset.images

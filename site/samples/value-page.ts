import { buildPage, valuePage } from '@maticsh/glasses'

export const preset = valuePage({
  label: 'next train',
  value: '4',
  unit: 'min',
  note: 'platform 2, then every six minutes until midnight',
})

export const page = buildPage(preset.spec)
export const images = preset.images

import { bar, sparkline, spinner } from '@maticsh/glasses'

// Plain text in the firmware font: each one is a cheap text write.
export const progress = bar(0.62, 260)
export const draining = bar(1 - 0.25, 260, { fill: '█', empty: '▁' })
export const steps = sparkline([3, 4, 4, 6, 9, 7, 5, 6, 8, 12, 10, 11])
export const frames = [0, 1, 2, 3].map(spinner)

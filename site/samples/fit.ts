import { fitLines, spread, truncate } from '@maticsh/glasses'

const note = 'Pick up the parcel from the front desk before six, '
  + 'then call the garage about the brakes.'

// Cut at a word to fit two lines in 288 px, with an ellipsis.
export const fitted = fitLines(note, 288, 2)

// One line, cut by pixels.
export const line = truncate(note, 288)

// Left and right on one line, padded with spaces by pixels.
export const status = spread('9:41', 'bat 84%', 288)

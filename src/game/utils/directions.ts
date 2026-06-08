import type { Direction, Point } from '../types'

/** The tile offset for each direction. Origin top-left; x grows right, y down. */
export const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Compass words for the activity log. */
export const DIR_NAME: Record<Direction, string> = {
  up: 'north',
  down: 'south',
  left: 'west',
  right: 'east',
}

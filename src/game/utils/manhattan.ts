import type { Point } from '../types'

/** The Manhattan (grid) distance between two points. */
export const manhattan = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

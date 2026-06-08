import type { Dungeon, Point } from '../types'
import { DELTA } from '../constants'

/** Light the hero's tile and its orthogonal neighbours — a one-step torch radius
 *  so corridors (which no room reveals) light up as the hero walks them. Mutates. */
export function markLit(seen: boolean[][], dungeon: Dungeon, p: Point): void {
  for (const d of [{ x: 0, y: 0 }, ...Object.values(DELTA)]) {
    const x = p.x + d.x
    const y = p.y + d.y
    if (y >= 0 && y < dungeon.rows && x >= 0 && x < dungeon.cols) seen[y][x] = true
  }
}

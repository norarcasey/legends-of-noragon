import type { Room } from '../types'

/** The room containing a tile, or `null` for walls / doorways between rooms. */
export function roomAt(rooms: Room[], x: number, y: number): number | null {
  for (const r of rooms) {
    if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.id
  }
  return null
}

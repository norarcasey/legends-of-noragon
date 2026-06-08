import type { Enemy, Point, Room } from '../types'

/** Choose a foe's next tile: one orthogonal step toward the hero, staying inside
 *  its room and off any occupied tile. Returns the foe's current tile if boxed in. */
export function chaseStep(rooms: Room[], foe: Enemy, target: Point, occupied: Set<string>): Point {
  const room = rooms[foe.room]
  const dx = target.x - foe.x
  const dy = target.y - foe.y
  const horiz: Point | null = dx !== 0 ? { x: foe.x + Math.sign(dx), y: foe.y } : null
  const vert: Point | null = dy !== 0 ? { x: foe.x, y: foe.y + Math.sign(dy) } : null
  // Try to close the larger gap first; fall back to the other axis if blocked.
  const candidates = Math.abs(dx) >= Math.abs(dy) ? [horiz, vert] : [vert, horiz]

  for (const c of candidates) {
    if (!c) continue
    const inRoom = c.x >= room.x0 && c.x <= room.x1 && c.y >= room.y0 && c.y <= room.y1
    if (inRoom && !occupied.has(`${c.x},${c.y}`)) return c
  }
  return { x: foe.x, y: foe.y }
}

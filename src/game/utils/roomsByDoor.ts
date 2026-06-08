import type { Dungeon, Point } from '../types'
import { DELTA } from './directions'
import { roomAt } from './roomAt'
import { tileAt } from './tileAt'

/** Rooms an orthogonal step from a door tile — so a hero standing in the doorway
 *  can see into the room beyond (and any foe waiting just inside). Empty off a door. */
export function roomsByDoor(dungeon: Dungeon, p: Point): number[] {
  if (tileAt(dungeon, p.x, p.y) !== 'door') return []
  const out: number[] = []
  for (const d of Object.values(DELTA)) {
    const room = roomAt(dungeon.rooms, p.x + d.x, p.y + d.y)
    if (room !== null) out.push(room)
  }
  return out
}

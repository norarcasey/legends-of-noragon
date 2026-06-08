import type { Enemy, Point, Room } from '../types'
import { roomAt } from './roomAt'
import { manhattan } from './manhattan'

/** A foe acts when the hero shares its room *or* is right beside it — so a foe at
 *  a doorway can still strike a hero loitering on the threshold (no safe poking). */
export function isActiveFoe(rooms: Room[], player: Point, foe: Enemy): boolean {
  return foe.room === roomAt(rooms, player.x, player.y) || manhattan(foe, player) === 1
}

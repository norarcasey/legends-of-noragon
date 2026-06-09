import type { Enemy, Point, Room } from '../types'
import { roomAt } from './roomAt'
import { manhattan } from './manhattan'

/** A foe acts when the hero shares its room, is right beside it (so a foe at a
 *  doorway can still strike a hero on the threshold — no safe poking), or its room
 *  is one the hero has `engaged` — e.g. a room peeked into and fired upon from a
 *  doorway, so a doorway shot draws that room's response. */
export function isActiveFoe(
  rooms: Room[],
  player: Point,
  foe: Enemy,
  engaged: number[] = [],
): boolean {
  return (
    foe.room === roomAt(rooms, player.x, player.y) ||
    engaged.includes(foe.room) ||
    manhattan(foe, player) === 1
  )
}

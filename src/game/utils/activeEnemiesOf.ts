import type { Enemy, Point, Room } from '../types'
import { isActiveFoe } from './isActiveFoe'

/** Foes that can act this turn — share the hero's room, are adjacent, or sit in an
 *  `engaged` (doorway-peeked) room — in id order. */
export function activeEnemiesOf(
  rooms: Room[],
  player: Point,
  enemies: Enemy[],
  engaged: number[] = [],
): Enemy[] {
  return enemies.filter((e) => isActiveFoe(rooms, player, e, engaged)).sort((a, b) => a.id - b.id)
}

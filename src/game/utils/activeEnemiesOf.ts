import type { Enemy, Point, Room } from '../types'
import { isActiveFoe } from './isActiveFoe'

/** Foes that can act this turn (share the hero's room or are adjacent), id order. */
export function activeEnemiesOf(rooms: Room[], player: Point, enemies: Enemy[]): Enemy[] {
  return enemies.filter((e) => isActiveFoe(rooms, player, e)).sort((a, b) => a.id - b.id)
}

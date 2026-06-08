import type { Enemy, Room } from '../types'
import { enemyStatsAt } from '../enemies'
import type { EnemyKind } from '../enemies'
import { roomAt } from './roomAt'

/** Spawn an enemy of `kind` at full health for the tile it was placed on, with
 *  its combat stats scaled to the `depth` it appears at (deeper = a bit tougher). */
export function spawnEnemy(
  rooms: Room[],
  kind: EnemyKind,
  id: number,
  x: number,
  y: number,
  depth: number,
): Enemy {
  const { maxHp, accuracy, damage, xp } = enemyStatsAt(kind, depth)
  return { id, kind, x, y, hp: maxHp, maxHp, accuracy, damage, xp, room: roomAt(rooms, x, y) ?? 0 }
}

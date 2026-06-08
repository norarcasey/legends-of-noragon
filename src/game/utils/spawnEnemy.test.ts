import { describe, expect, it } from 'vitest'
import { spawnEnemy } from './spawnEnemy'
import { enemyStatsAt } from '../enemies'
import type { Room } from '../types'

const rooms: Room[] = [{ id: 3, name: 'a', x0: 0, y0: 0, x1: 4, y1: 4 }]

describe('spawnEnemy', () => {
  it('starts at full health with depth-scaled stats and the right room', () => {
    const e = spawnEnemy(rooms, 'goblin', 7, 2, 2, 1)
    const stats = enemyStatsAt('goblin', 1)
    expect(e).toMatchObject({ id: 7, kind: 'goblin', x: 2, y: 2, room: 3 })
    expect(e.hp).toBe(stats.maxHp)
    expect(e.maxHp).toBe(stats.maxHp)
    expect(e.accuracy).toBe(stats.accuracy)
    expect(e.damage).toBe(stats.damage)
    expect(e.xp).toBe(stats.xp)
  })

  it('scales the same kind up with depth', () => {
    const shallow = spawnEnemy(rooms, 'goblin', 0, 1, 1, 1)
    const deep = spawnEnemy(rooms, 'goblin', 0, 1, 1, 6)
    expect(deep.maxHp).toBeGreaterThan(shallow.maxHp)
  })

  it('defaults the room to 0 when the tile is in no room', () => {
    expect(spawnEnemy(rooms, 'bat', 0, 99, 99, 1).room).toBe(0)
  })
})

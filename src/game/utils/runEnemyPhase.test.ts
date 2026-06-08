import { describe, expect, it } from 'vitest'
import { runEnemyPhase } from './runEnemyPhase'
import type { Dungeon, Enemy, Room, TileType } from '../types'

const rooms: Room[] = [
  { id: 0, name: 'a', x0: 0, y0: 0, x1: 4, y1: 4 },
  { id: 1, name: 'b', x0: 10, y0: 10, x1: 12, y1: 12 },
]
const dungeon: Dungeon = {
  cols: 13,
  rows: 13,
  tiles: Array.from({ length: 13 }, () => Array.from({ length: 13 }, (): TileType => 'floor')),
  rooms,
  playerStart: { x: 2, y: 2 },
  enemies: [],
  items: [],
}
const foe = (id: number, x: number, y: number, room: number, over: Partial<Enemy> = {}): Enemy => ({
  id,
  kind: 'goblin',
  x,
  y,
  hp: 8,
  maxHp: 8,
  accuracy: 0.6,
  damage: 3,
  xp: 12,
  room,
  ...over,
})
/** A roll() that yields the given values in order. */
const rolls = (...values: number[]) => {
  let i = 0
  return () => values[i++]
}

describe('runEnemyPhase', () => {
  it('an adjacent foe that hits deals damage minus armor', () => {
    const messages: string[] = []
    const r = runEnemyPhase(dungeon, { x: 2, y: 2 }, [foe(0, 2, 3, 0)], 20, 1, rolls(0), messages)
    expect(r.hp).toBe(20 - (3 - 1)) // 18
    expect(messages[0]).toMatch(/Goblin/)
  })

  it('armor can fully soak a hit', () => {
    const messages: string[] = []
    const weak = foe(0, 2, 3, 0, { damage: 1 })
    const r = runEnemyPhase(dungeon, { x: 2, y: 2 }, [weak], 20, 5, rolls(0), messages)
    expect(r.hp).toBe(20)
    expect(messages[0]).toMatch(/armor holds/)
  })

  it('an adjacent foe that misses deals nothing', () => {
    const messages: string[] = []
    const r = runEnemyPhase(
      dungeon,
      { x: 2, y: 2 },
      [foe(0, 2, 3, 0)],
      20,
      0,
      rolls(0.99),
      messages,
    )
    expect(r.hp).toBe(20)
    expect(messages[0]).toMatch(/misses you/)
  })

  it('a non-adjacent foe in the room chases one step closer', () => {
    const messages: string[] = []
    const r = runEnemyPhase(dungeon, { x: 2, y: 2 }, [foe(0, 4, 4, 0)], 20, 0, rolls(), messages)
    expect(r.enemies[0]).toMatchObject({ x: 3, y: 4 }) // stepped toward the hero on x
    expect(r.hp).toBe(20)
  })

  it('a foe in another room (not adjacent) stays put', () => {
    const messages: string[] = []
    const idle = foe(0, 11, 11, 1)
    const r = runEnemyPhase(dungeon, { x: 2, y: 2 }, [idle], 20, 0, rolls(), messages)
    expect(r.enemies[0]).toEqual(idle)
    expect(messages).toHaveLength(0)
  })
})

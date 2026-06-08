import { describe, expect, it } from 'vitest'
import { activeEnemiesOf } from './activeEnemiesOf'
import type { Enemy, Room } from '../types'

const rooms: Room[] = [
  { id: 0, name: 'a', x0: 0, y0: 0, x1: 2, y1: 2 },
  { id: 1, name: 'b', x0: 5, y0: 5, x1: 7, y1: 7 },
]
const foe = (id: number, x: number, y: number, room: number): Enemy => ({
  id,
  kind: 'bat',
  x,
  y,
  hp: 3,
  maxHp: 3,
  accuracy: 0.6,
  damage: 1,
  xp: 4,
  room,
})

describe('activeEnemiesOf', () => {
  it('keeps only foes sharing the room (or adjacent), sorted by id', () => {
    const enemies = [
      foe(2, 1, 1, 0), // in the hero's room
      foe(9, 6, 6, 1), // far away in another room
      foe(1, 0, 0, 0), // also in the hero's room
    ]
    const active = activeEnemiesOf(rooms, { x: 1, y: 1 }, enemies)
    expect(active.map((e) => e.id)).toEqual([1, 2])
  })

  it('is empty when nothing is in range', () => {
    expect(activeEnemiesOf(rooms, { x: 1, y: 1 }, [foe(0, 6, 6, 1)])).toEqual([])
  })
})

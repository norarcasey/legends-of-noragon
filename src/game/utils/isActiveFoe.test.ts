import { describe, expect, it } from 'vitest'
import { isActiveFoe } from './isActiveFoe'
import type { Enemy, Room } from '../types'

const rooms: Room[] = [
  { id: 0, name: 'a', x0: 0, y0: 0, x1: 2, y1: 2 },
  { id: 1, name: 'b', x0: 5, y0: 5, x1: 7, y1: 7 },
]
const foe = (x: number, y: number, room: number): Enemy => ({
  id: 0,
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

describe('isActiveFoe', () => {
  it('is active when the hero shares its room', () => {
    expect(isActiveFoe(rooms, { x: 0, y: 0 }, foe(2, 2, 0))).toBe(true)
  })

  it('is active when adjacent even across a room boundary', () => {
    // Hero in room 1, foe one tile away in a doorway (room 0).
    expect(isActiveFoe(rooms, { x: 5, y: 5 }, foe(4, 5, 0))).toBe(true)
  })

  it('is inactive when in a different room and not adjacent', () => {
    expect(isActiveFoe(rooms, { x: 6, y: 6 }, foe(1, 1, 0))).toBe(false)
  })
})

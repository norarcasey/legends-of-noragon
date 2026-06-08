import { describe, expect, it } from 'vitest'
import { roomsByDoor } from './roomsByDoor'
import type { Dungeon, Room } from '../types'

// Two 1-wide rooms at x=0 and x=2, with a door between them at (1, 0).
const rooms: Room[] = [
  { id: 0, name: 'left', x0: 0, y0: 0, x1: 0, y1: 0 },
  { id: 1, name: 'right', x0: 2, y0: 0, x1: 2, y1: 0 },
]
const d: Dungeon = {
  cols: 3,
  rows: 1,
  tiles: [['floor', 'door', 'floor']],
  rooms,
  playerStart: { x: 0, y: 0 },
  enemies: [],
  items: [],
}

describe('roomsByDoor', () => {
  it('returns the rooms on both sides of a doorway', () => {
    expect(roomsByDoor(d, { x: 1, y: 0 }).sort()).toEqual([0, 1])
  })

  it('returns nothing when not standing on a door', () => {
    expect(roomsByDoor(d, { x: 0, y: 0 })).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { roomAt } from './roomAt'
import type { Room } from '../types'

const rooms: Room[] = [
  { id: 0, name: 'a', x0: 1, y0: 1, x1: 3, y1: 3 },
  { id: 1, name: 'b', x0: 6, y0: 6, x1: 8, y1: 8 },
]

describe('roomAt', () => {
  it('returns the id of the room containing the tile (inclusive bounds)', () => {
    expect(roomAt(rooms, 2, 2)).toBe(0)
    expect(roomAt(rooms, 1, 1)).toBe(0) // top-left corner
    expect(roomAt(rooms, 8, 8)).toBe(1) // bottom-right corner
  })

  it('returns null for tiles outside every room', () => {
    expect(roomAt(rooms, 0, 0)).toBeNull()
    expect(roomAt(rooms, 4, 4)).toBeNull() // gap between rooms
  })
})

import { describe, expect, it } from 'vitest'
import { computeVisible } from './computeVisible'
import type { Dungeon, Room, TileType } from '../types'

// A 7x7 all-wall grid with one 3x3 room (interior x/y 2..4).
const room: Room = { id: 0, name: 'a', x0: 2, y0: 2, x1: 4, y1: 4 }
const d: Dungeon = {
  cols: 7,
  rows: 7,
  tiles: Array.from({ length: 7 }, () => Array.from({ length: 7 }, (): TileType => 'wall')),
  rooms: [room],
  playerStart: { x: 3, y: 3 },
  enemies: [],
  items: [],
}

describe('computeVisible', () => {
  it('reveals nothing when no rooms are known', () => {
    const v = computeVisible(d, [])
    expect(v.flat().some(Boolean)).toBe(false)
  })

  it('lights a revealed room plus its surrounding ring', () => {
    const v = computeVisible(d, [0])
    expect(v[3][3]).toBe(true) // interior
    expect(v[1][1]).toBe(true) // ring corner (x0-1, y0-1)
    expect(v[5][5]).toBe(true) // ring corner (x1+1, y1+1)
    expect(v[0][0]).toBe(false) // beyond the ring stays dark
  })
})

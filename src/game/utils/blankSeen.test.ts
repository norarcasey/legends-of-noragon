import { describe, expect, it } from 'vitest'
import { blankSeen } from './blankSeen'
import type { Dungeon, TileType } from '../types'

const dungeon = (tiles: TileType[][]): Dungeon => ({
  cols: tiles[0].length,
  rows: tiles.length,
  tiles,
  rooms: [],
  playerStart: { x: 0, y: 0 },
  enemies: [],
  items: [],
  shop: null,
})

describe('blankSeen', () => {
  it('matches the dungeon dimensions and is all false', () => {
    const d = dungeon([
      ['wall', 'floor', 'floor'],
      ['wall', 'floor', 'wall'],
    ])
    const seen = blankSeen(d)
    expect(seen).toHaveLength(2)
    expect(seen[0]).toHaveLength(3)
    expect(seen.flat().every((v) => v === false)).toBe(true)
  })
})

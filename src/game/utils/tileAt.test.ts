import { describe, expect, it } from 'vitest'
import { tileAt } from './tileAt'
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

const d = dungeon([
  ['wall', 'floor', 'door'],
  ['wall', 'chest', 'stairs'],
])

describe('tileAt', () => {
  it('returns the tile within bounds', () => {
    expect(tileAt(d, 1, 0)).toBe('floor')
    expect(tileAt(d, 2, 1)).toBe('stairs')
    expect(tileAt(d, 1, 1)).toBe('chest')
  })

  it('treats out-of-bounds as wall', () => {
    expect(tileAt(d, -1, 0)).toBe('wall')
    expect(tileAt(d, 0, -1)).toBe('wall')
    expect(tileAt(d, 3, 0)).toBe('wall')
    expect(tileAt(d, 0, 2)).toBe('wall')
  })
})

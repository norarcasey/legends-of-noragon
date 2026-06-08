import { describe, expect, it } from 'vitest'
import { markLit } from './markLit'
import { blankSeen } from './blankSeen'
import type { Dungeon, TileType } from '../types'

const floor3x3 = (): Dungeon => {
  const tiles: TileType[][] = Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, (): TileType => 'floor'),
  )
  return { cols: 3, rows: 3, tiles, rooms: [], playerStart: { x: 0, y: 0 }, enemies: [], items: [] }
}

describe('markLit', () => {
  it('lights the tile and its four orthogonal neighbours', () => {
    const d = floor3x3()
    const seen = blankSeen(d)
    markLit(seen, d, { x: 1, y: 1 })
    expect(seen[1][1]).toBe(true) // centre
    expect(seen[0][1]).toBe(true) // up
    expect(seen[2][1]).toBe(true) // down
    expect(seen[1][0]).toBe(true) // left
    expect(seen[1][2]).toBe(true) // right
    expect(seen[0][0]).toBe(false) // diagonal stays dark
  })

  it('clamps at the grid edge without erroring', () => {
    const d = floor3x3()
    const seen = blankSeen(d)
    markLit(seen, d, { x: 0, y: 0 })
    expect(seen[0][0]).toBe(true)
    expect(seen[0][1]).toBe(true)
    expect(seen[1][0]).toBe(true)
  })
})

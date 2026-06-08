import { describe, expect, it } from 'vitest'
import { generateDungeon } from './generateDungeon'
import type { Dungeon, Point, TileType } from '../types'

const SEEDS = [1, 7, 42, 99, 256, 4242]

const countTiles = (d: Dungeon, t: TileType) => d.tiles.flat().filter((x) => x === t).length

/** Flood-fill over walkable (non-wall) tiles from the start; can we reach `to`? */
function reaches(d: Dungeon, from: Point, to: Point): boolean {
  const key = (p: Point) => `${p.x},${p.y}`
  const seen = new Set([key(from)])
  const queue: Point[] = [from]
  const deltas = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ]
  while (queue.length) {
    const c = queue.shift()
    if (!c) break
    if (c.x === to.x && c.y === to.y) return true
    for (const dlt of deltas) {
      const nx = c.x + dlt.x
      const ny = c.y + dlt.y
      const tile = d.tiles[ny]?.[nx]
      if (!tile || tile === 'wall' || seen.has(`${nx},${ny}`)) continue
      seen.add(`${nx},${ny}`)
      queue.push({ x: nx, y: ny })
    }
  }
  return false
}

describe('generateDungeon', () => {
  it('is deterministic for the same (seed, depth)', () => {
    expect(generateDungeon(7, 1)).toEqual(generateDungeon(7, 1))
  })

  it('varies with seed and with depth', () => {
    expect(generateDungeon(7, 1)).not.toEqual(generateDungeon(8, 1))
    expect(generateDungeon(7, 1)).not.toEqual(generateDungeon(7, 2))
  })

  it('is walled, holds exactly one chest, and is fully solvable', () => {
    for (const seed of SEEDS) {
      const d = generateDungeon(seed, 1)
      // Solid outer border.
      for (let x = 0; x < d.cols; x++) {
        expect(d.tiles[0][x]).toBe('wall')
        expect(d.tiles[d.rows - 1][x]).toBe('wall')
      }
      for (let y = 0; y < d.rows; y++) {
        expect(d.tiles[y][0]).toBe('wall')
        expect(d.tiles[y][d.cols - 1]).toBe('wall')
      }
      // Exactly one chest; the hero starts on floor; the chest is reachable.
      expect(countTiles(d, 'chest')).toBe(1)
      expect(d.tiles[d.playerStart.y][d.playerStart.x]).toBe('floor')
      let chest: Point | null = null
      for (let y = 0; y < d.rows; y++) {
        for (let x = 0; x < d.cols; x++) if (d.tiles[y][x] === 'chest') chest = { x, y }
      }
      expect(chest).not.toBeNull()
      if (chest) expect(reaches(d, d.playerStart, chest)).toBe(true)
    }
  })

  it('spawns no enemy on the start tile', () => {
    for (const seed of SEEDS) {
      const d = generateDungeon(seed, 3)
      for (const e of d.enemies) {
        expect(e.x === d.playerStart.x && e.y === d.playerStart.y).toBe(false)
      }
    }
  })
})

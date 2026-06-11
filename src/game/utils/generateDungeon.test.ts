import { describe, expect, it } from 'vitest'
import { generateDungeon } from './generateDungeon'
import { SHOP } from '../constants'
import type { Dungeon, Point, TileType } from '../types'

const SEEDS = [1, 7, 42, 99, 256, 4242]

const countTiles = (d: Dungeon, t: TileType) => d.tiles.flat().filter((x) => x === t).length

/** Flood-fill over walkable tiles (not wall, not impassable rubble) from the
 *  start; can we reach `to`? */
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
      if (
        !tile ||
        tile === 'wall' ||
        tile === 'rubble' ||
        tile === 'merchant' ||
        seen.has(`${nx},${ny}`)
      )
        continue
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

  it('drops impassable rubble that is isolated and never seals off the level', () => {
    let total = 0
    for (const seed of SEEDS) {
      const d = generateDungeon(seed, 2)
      const startRoom = d.rooms.find(
        (r) =>
          d.playerStart.x >= r.x0 &&
          d.playerStart.x <= r.x1 &&
          d.playerStart.y >= r.y0 &&
          d.playerStart.y <= r.y1,
      )
      for (let y = 0; y < d.rows; y++) {
        for (let x = 0; x < d.cols; x++) {
          if (d.tiles[y][x] !== 'rubble') continue
          total++
          // Each pile stands alone — no orthogonally adjacent rubble — so a
          // single block can never wall a corner off.
          expect(d.tiles[y][x - 1]).not.toBe('rubble')
          expect(d.tiles[y][x + 1]).not.toBe('rubble')
          expect(d.tiles[y - 1][x]).not.toBe('rubble')
          expect(d.tiles[y + 1][x]).not.toBe('rubble')
          // The safe entry hall stays clear of obstacles.
          if (startRoom) {
            const inStart =
              x >= startRoom.x0 && x <= startRoom.x1 && y >= startRoom.y0 && y <= startRoom.y1
            expect(inStart).toBe(false)
          }
        }
      }
      // The chest stays reachable even with rubble in the way (reaches() blocks it).
      let chest: Point | null = null
      for (let y = 0; y < d.rows; y++) {
        for (let x = 0; x < d.cols; x++) if (d.tiles[y][x] === 'chest') chest = { x, y }
      }
      if (chest) expect(reaches(d, d.playerStart, chest)).toBe(true)
    }
    // Rubble actually appears across the sampled levels.
    expect(total).toBeGreaterThan(0)
  })

  it('scatters side-steppable traps inside rooms, never the start hall', () => {
    let total = 0
    for (const seed of SEEDS) {
      const d = generateDungeon(seed, 3)
      const startRoom = d.rooms.find(
        (r) =>
          d.playerStart.x >= r.x0 &&
          d.playerStart.x <= r.x1 &&
          d.playerStart.y >= r.y0 &&
          d.playerStart.y <= r.y1,
      )
      for (let y = 0; y < d.rows; y++) {
        for (let x = 0; x < d.cols; x++) {
          if (d.tiles[y][x] !== 'trap') continue
          total++
          // Traps live inside a room, so there's always an adjacent walkable tile
          // to skirt them — never in a one-wide corridor or doorway.
          const room = d.rooms.find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)
          expect(room).toBeTruthy()
          // The safe entry hall stays trap-free.
          if (startRoom) {
            const inStart =
              x >= startRoom.x0 && x <= startRoom.x1 && y >= startRoom.y0 && y <= startRoom.y1
            expect(inStart).toBe(false)
          }
        }
      }
      // The chest stays reachable (traps are walkable, so the path is never cut).
      let chest: Point | null = null
      for (let y = 0; y < d.rows; y++) {
        for (let x = 0; x < d.cols; x++) if (d.tiles[y][x] === 'chest') chest = { x, y }
      }
      if (chest) expect(reaches(d, d.playerStart, chest)).toBe(true)
    }
    // Traps actually appear across the sampled levels.
    expect(total).toBeGreaterThan(0)
  })

  it('places a stocked merchant in a safe shop room', () => {
    for (const seed of SEEDS) {
      const d = generateDungeon(seed, 2)
      expect(d.shop).not.toBeNull()
      if (!d.shop) continue
      // The merchant stands on a `merchant` tile, the room is enemy-free, and the
      // shelves are stocked.
      expect(d.tiles[d.shop.merchant.y][d.shop.merchant.x]).toBe('merchant')
      expect(d.enemies.every((e) => e.room !== d.shop?.room)).toBe(true)
      expect(d.shop.stock).toHaveLength(SHOP.stockSize)
      // The shop is never the entry hall, and is still reachable from the start.
      const startRoom = d.rooms.find(
        (r) =>
          d.playerStart.x >= r.x0 &&
          d.playerStart.x <= r.x1 &&
          d.playerStart.y >= r.y0 &&
          d.playerStart.y <= r.y1,
      )
      expect(d.shop.room).not.toBe(startRoom?.id)
      expect(reaches(d, d.playerStart, d.shop.merchant)).toBe(false) // merchant tile itself is impassable
      const beside = { x: d.shop.merchant.x + 1, y: d.shop.merchant.y }
      expect(reaches(d, d.playerStart, beside)).toBe(true) // but you can reach its counter
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

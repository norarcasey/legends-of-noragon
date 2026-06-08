import type { Dungeon } from '../types'

/**
 * Build the fog-of-war mask for a set of revealed rooms. A tile is visible when
 * it falls within a revealed room's interior *or* the ring of walls/doorways
 * around it — so entering a room lights up the room, its walls, and the doors
 * out of it, while everything beyond stays dark until you cross the threshold.
 */
export function computeVisible(dungeon: Dungeon, revealedRooms: number[]): boolean[][] {
  const grid: boolean[][] = dungeon.tiles.map((row) => row.map(() => false))
  for (const id of revealedRooms) {
    const r = dungeon.rooms[id]
    for (let y = r.y0 - 1; y <= r.y1 + 1; y++) {
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        if (y >= 0 && y < dungeon.rows && x >= 0 && x < dungeon.cols) grid[y][x] = true
      }
    }
  }
  return grid
}

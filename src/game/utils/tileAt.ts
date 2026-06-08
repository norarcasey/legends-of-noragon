import type { Dungeon, TileType } from '../types'

/** The tile at (x, y), treating anything off the grid as `wall`. */
export function tileAt(dungeon: Dungeon, x: number, y: number): TileType {
  if (y < 0 || y >= dungeon.rows || x < 0 || x >= dungeon.cols) return 'wall'
  return dungeon.tiles[y][x]
}

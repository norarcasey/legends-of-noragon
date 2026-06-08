import type { Dungeon } from '../types'

/** A fresh all-dark "seen" map sized to the dungeon. */
export function blankSeen(dungeon: Dungeon): boolean[][] {
  return dungeon.tiles.map((row) => row.map(() => false))
}

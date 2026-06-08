import { LEVELING } from './leveling'

/** XP needed to advance from `level` to the next (quadratic in level). */
export function xpToNext(level: number): number {
  return LEVELING.xpPerLevel * level * level
}

import type { Equipment, HeroStats, InventoryItem, LeveledStats } from '../types'
import { xpToNext } from './xpToNext'
import { statsAt } from './statsAt'
import { deriveCombat } from './deriveCombat'

/**
 * Apply earned XP, leveling the hero up as thresholds are crossed. Each level-up
 * raises max HP / damage / accuracy and fully heals; the new stats are derived
 * from `base` plus equipped gear. Pushes a log line per level gained. Pure.
 */
export function applyXp(
  base: HeroStats,
  level: number,
  xp: number,
  hp: number,
  gained: number,
  messages: string[],
  inventory: InventoryItem[],
  equipment: Equipment,
): LeveledStats {
  let lvl = level
  let prog = xp + gained
  let nextHp = hp
  while (prog >= xpToNext(lvl)) {
    prog -= xpToNext(lvl)
    lvl += 1
    nextHp = statsAt(base, lvl).maxHp // level-ups fully heal
    messages.push(`You reach level ${lvl}! You feel tougher and deadlier.`)
  }
  const c = deriveCombat(base, lvl, inventory, equipment)
  return {
    level: lvl,
    xp: prog,
    maxHp: c.maxHp,
    attacks: c.attacks,
    defense: c.defense,
    hp: nextHp,
  }
}

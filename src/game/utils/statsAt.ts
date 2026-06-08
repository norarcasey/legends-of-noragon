import type { HeroStats } from '../types'
import { LEVELING } from './leveling'
import { leveledProfile } from './leveledProfile'

/** The hero's current max HP and attack profiles at a given level, derived from
 *  their base (level-1) profile so stats never drift. */
export function statsAt(base: HeroStats, level: number): HeroStats {
  const bonus = level - 1
  return {
    maxHp: base.maxHp + bonus * LEVELING.hpPerLevel,
    attacks: {
      melee: leveledProfile(base.attacks.melee, bonus),
      ranged: leveledProfile(base.attacks.ranged, bonus),
      spell: leveledProfile(base.attacks.spell, bonus),
    },
  }
}

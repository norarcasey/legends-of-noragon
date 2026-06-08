import type { AttackProfile } from '../types'
import { LEVELING } from './leveling'

/** Grow an attack profile by `bonus` levels (accuracy never exceeds 1). */
export function leveledProfile(p: AttackProfile, bonus: number): AttackProfile {
  return {
    accuracy: Math.min(1, p.accuracy + bonus * LEVELING.accuracyPerLevel),
    minDamage: p.minDamage + bonus * LEVELING.damagePerLevel,
    maxDamage: p.maxDamage + bonus * LEVELING.damagePerLevel,
  }
}

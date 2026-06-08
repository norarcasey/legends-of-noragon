import type { AttackProfile } from '../types'

/**
 * Resolve one attack against a profile, drawing from `roll`: first the to-hit
 * check, then (on a hit) the damage within the profile's range. Generic over
 * attack kind, so melee/ranged/spell all share this once they're wired up.
 */
export function resolveAttack(
  profile: AttackProfile,
  roll: () => number,
): { hit: boolean; damage: number } {
  if (roll() >= profile.accuracy) return { hit: false, damage: 0 }
  const span = profile.maxDamage - profile.minDamage + 1
  return { hit: true, damage: profile.minDamage + Math.floor(roll() * span) }
}

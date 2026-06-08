import type { CombatStats, Equipment, HeroStats, InventoryItem } from '../types'
import { statsAt } from './statsAt'
import { equippedDef } from './equippedDef'

/** The hero's effective combat stats: leveled base, plus the equipped weapon's
 *  melee bonus and the equipped armor's flat defense. */
export function deriveCombat(
  base: HeroStats,
  level: number,
  inventory: InventoryItem[],
  equipment: Equipment,
): CombatStats {
  const leveled = statsAt(base, level)
  const weapon = equippedDef(inventory, equipment.weapon)
  const armor = equippedDef(inventory, equipment.armor)
  const melee = weapon
    ? {
        accuracy: Math.min(1, leveled.attacks.melee.accuracy + weapon.meleeAccuracy),
        minDamage: leveled.attacks.melee.minDamage + weapon.meleeDamage,
        maxDamage: leveled.attacks.melee.maxDamage + weapon.meleeDamage,
      }
    : leveled.attacks.melee
  return {
    maxHp: leveled.maxHp,
    attacks: { ...leveled.attacks, melee },
    defense: armor ? armor.defense : 0,
  }
}

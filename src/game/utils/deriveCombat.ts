import type { CombatStats, Equipment, HeroStats, InventoryItem } from '../types'
import type { ItemDef } from '../items'
import { statsAt } from './statsAt'
import { equippedDef } from './equippedDef'

/** The hero's effective combat stats: the leveled base plus every worn piece's
 *  contribution — melee bonus, flat defense, and bonus max HP — summed across
 *  the weapon, armor, ring, and amulet slots. */
export function deriveCombat(
  base: HeroStats,
  level: number,
  inventory: InventoryItem[],
  equipment: Equipment,
): CombatStats {
  const leveled = statsAt(base, level)
  const worn = [equipment.weapon, equipment.armor, ...equipment.rings, equipment.amulet].map((id) =>
    equippedDef(inventory, id),
  )
  const bonus = (pick: (d: ItemDef) => number) =>
    worn.reduce((total, d) => total + (d ? pick(d) : 0), 0)
  const melee = {
    accuracy: Math.max(
      0,
      Math.min(1, leveled.attacks.melee.accuracy + bonus((d) => d.meleeAccuracy)),
    ),
    minDamage: leveled.attacks.melee.minDamage + bonus((d) => d.meleeDamage),
    maxDamage: leveled.attacks.melee.maxDamage + bonus((d) => d.meleeDamage),
  }
  return {
    maxHp: leveled.maxHp + bonus((d) => d.maxHp),
    attacks: { ...leveled.attacks, melee },
    defense: bonus((d) => d.defense),
  }
}

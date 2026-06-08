/**
 * Leveling knobs — expect to tune these as the dungeon deepens. XP to advance
 * from level L to L+1 is `xpPerLevel * L²` (a steep curve so later levels cost a
 * lot more); each level grants more max HP, more damage, and a little accuracy.
 */
export const LEVELING = {
  xpPerLevel: 24,
  hpPerLevel: 4,
  damagePerLevel: 1,
  accuracyPerLevel: 0.02,
  /** Treasure XP from a chest, multiplied by the current dungeon depth. */
  chestXp: 12,
}

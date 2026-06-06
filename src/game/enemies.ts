// The bestiary: the kinds of enemy the dungeon can hold, their flavor, and their
// combat stats. Framework-free so the engine and the React layer can share it.

/** Every enemy kind the game knows about. */
export type EnemyKind = 'bat' | 'goblin'

/** Everything that defines an enemy kind: how it reads and how it fights. */
export interface EnemyInfo {
  name: string
  description: string
  /** The block glyph drawn on the board. */
  glyph: string
  /** Starting (and maximum) hit points. */
  maxHp: number
  /** Chance (0–1) that it lands an attack when adjacent. */
  accuracy: number
  /** Flat damage a landed attack deals. */
  damage: number
  /** Verb used in the activity log when it hits, e.g. "bites". */
  verb: string
  /** Experience the hero earns for slaying one. */
  xp: number
}

export const ENEMY_INFO: Record<EnemyKind, EnemyInfo> = {
  bat: {
    name: 'Bat',
    description:
      'A leathery cave-dweller that flits at intruders and nips for a single point of damage.',
    glyph: '𝕓',
    maxHp: 3,
    accuracy: 0.6,
    damage: 1,
    verb: 'bites',
    xp: 4,
  },
  goblin: {
    name: 'Goblin',
    description:
      'A wiry raider with a rusty blade — far sturdier than a bat, and its swings bite deep.',
    glyph: '𝕘',
    maxHp: 8,
    accuracy: 0.7,
    damage: 2,
    verb: 'slashes',
    xp: 12,
  },
}

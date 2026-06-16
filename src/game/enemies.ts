// The bestiary: the kinds of enemy the dungeon can hold, their flavor, and their
// combat stats. Framework-free so the engine and the React layer can share it.

/** Every enemy kind the game knows about, roughly weakest → strongest. */
export type EnemyKind =
  | 'bat'
  | 'kobold'
  | 'spider'
  | 'direWolf'
  | 'skeleton'
  | 'goblin'
  | 'orc'
  | 'ogre'
  | 'troll'
  | 'wraith'

/** Everything that defines an enemy kind: how it reads and how it fights. */
export interface EnemyInfo {
  name: string
  description: string
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
  /** Shallowest dungeon depth this kind may spawn at (1 = the entrance level).
   *  Keeps heavy hitters like orcs and trolls out of the early floors. */
  minDepth: number
}

export const ENEMY_INFO: Record<EnemyKind, EnemyInfo> = {
  bat: {
    name: 'Bat',
    description:
      'A leathery cave-dweller that flits at intruders and nips for a single point of damage.',
    maxHp: 3,
    accuracy: 0.6,
    damage: 1,
    verb: 'bites',
    xp: 4,
    minDepth: 1,
  },
  kobold: {
    name: 'Kobold',
    description:
      'A scrappy little cave-dweller that jabs with a crude spear and bolts the moment things turn.',
    maxHp: 4,
    accuracy: 0.7,
    damage: 1,
    verb: 'jabs',
    xp: 5,
    minDepth: 1,
  },
  spider: {
    name: 'Spider',
    description:
      'A skittering cave-spider — fragile, but its fangs strike fast and find their mark.',
    maxHp: 2,
    accuracy: 0.75,
    damage: 2,
    verb: 'bites',
    xp: 6,
    minDepth: 1,
  },
  direWolf: {
    name: 'Dire Wolf',
    description:
      'A huge wolf that hunts the dark in a pack — fast, and unerring once it has your scent.',
    maxHp: 6,
    accuracy: 0.8,
    damage: 2,
    verb: 'bites',
    xp: 9,
    minDepth: 1,
  },
  skeleton: {
    name: 'Skeleton',
    description:
      'A rattling undead warrior — no flesh to tire and no fear to break, so it never gives ground.',
    maxHp: 6,
    accuracy: 0.7,
    damage: 2,
    verb: 'strikes',
    xp: 10,
    minDepth: 3,
  },
  goblin: {
    name: 'Goblin',
    description:
      'A wiry raider with a rusty blade — far sturdier than a bat, and its swings bite deep.',
    maxHp: 8,
    accuracy: 0.7,
    damage: 2,
    verb: 'slashes',
    xp: 12,
    minDepth: 1,
  },
  orc: {
    name: 'Orc',
    description:
      'A brutish marauder swinging a heavy cleaver — it soaks blows and hits a good deal harder.',
    maxHp: 12,
    accuracy: 0.7,
    damage: 3,
    verb: 'cleaves',
    xp: 18,
    minDepth: 3,
  },
  ogre: {
    name: 'Ogre',
    description:
      'A hulking brute with a tree-trunk club — slow to swing, but it caves in armor when it lands.',
    maxHp: 16,
    accuracy: 0.65,
    damage: 4,
    verb: 'clubs',
    xp: 28,
    minDepth: 4,
  },
  troll: {
    name: 'Troll',
    description:
      'A lumbering troll with immense hit points and a crushing slam. Soften it from afar first.',
    maxHp: 20,
    accuracy: 0.6,
    damage: 5,
    verb: 'smashes',
    xp: 40,
    minDepth: 4,
  },
  wraith: {
    name: 'Wraith',
    description:
      'A cold, half-there specter whose touch finds the gaps in any guard. Little substance, much menace.',
    maxHp: 14,
    accuracy: 0.85,
    damage: 5,
    verb: 'rends',
    xp: 45,
    minDepth: 5,
  },
}

/**
 * How much a foe's combat stats grow per level of depth below the first. Modest,
 * so the same kinds stiffen gradually as you descend rather than spiking: deeper
 * bats and goblins hit a touch harder, take a few more blows, and are worth a bit
 * more XP. `ENEMY_INFO` holds the depth-1 baseline; {@link enemyStatsAt} applies
 * this on top.
 */
export const ENEMY_DEPTH_SCALING = {
  /** Fractional bonus to max HP per depth (e.g. 0.08 → +8% per level down). */
  hpPerDepth: 0.08,
  /** Fractional bonus to a landed hit's damage per depth. */
  damagePerDepth: 0.06,
  /** Flat bonus to accuracy per depth, before the cap. */
  accuracyPerDepth: 0.005,
  /** Fractional bonus to slay XP per depth — tougher foes are worth more. */
  xpPerDepth: 0.06,
  /** Accuracy never scales past this, however deep the run goes. */
  accuracyCap: 0.95,
}

/** A foe kind's combat stats at a given dungeon `depth` (1 = the entrance),
 *  scaled up from its {@link ENEMY_INFO} baseline. Rounds HP/damage/XP to whole
 *  numbers and clamps accuracy. Pure and deterministic. */
export function enemyStatsAt(
  kind: EnemyKind,
  depth: number,
): { maxHp: number; accuracy: number; damage: number; xp: number } {
  const info = ENEMY_INFO[kind]
  const d = Math.max(0, depth - 1)
  return {
    maxHp: Math.round(info.maxHp * (1 + d * ENEMY_DEPTH_SCALING.hpPerDepth)),
    damage: Math.round(info.damage * (1 + d * ENEMY_DEPTH_SCALING.damagePerDepth)),
    accuracy: Math.min(
      ENEMY_DEPTH_SCALING.accuracyCap,
      info.accuracy + d * ENEMY_DEPTH_SCALING.accuracyPerDepth,
    ),
    xp: Math.round(info.xp * (1 + d * ENEMY_DEPTH_SCALING.xpPerDepth)),
  }
}

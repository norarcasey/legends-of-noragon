// Game-wide tuning constants — every tunable literal in one place: the hero
// defaults, the leveling curve, movement deltas, and the map-generation
// dimensions. Domain-specific constants stay with their modules (item values in
// items.ts, enemy depth-scaling in enemies.ts).

import type { AttackProfiles, Direction, Point } from './types'

/** The hero's default level-1 (and starting) max hit points. */
export const DEFAULTS = { maxHp: 12 }

/**
 * Default attack profiles. `melee` drives the current bump-to-attack; `ranged`
 * and `spell` are tuned and ready but not yet wired to a targeting action.
 */
export const DEFAULT_ATTACKS: AttackProfiles = {
  melee: { accuracy: 0.8, minDamage: 3, maxDamage: 6 },
  ranged: { accuracy: 0.6, minDamage: 2, maxDamage: 4 },
  spell: { accuracy: 0.9, minDamage: 3, maxDamage: 6 },
}

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
}

/**
 * Shop economy. The merchant marks stock up over its base value and buys your
 * wares back at a fraction of it — so gold matters and trading isn't free.
 */
export const SHOP = {
  buyMarkup: 1.25,
  sellRate: 0.5,
  /** How many items a merchant stocks (a couple of potions plus random gear). */
  stockSize: 5,
}

/**
 * Traps. They're visible, so the hero can step around them; springing one deals
 * flat damage (armor doesn't help against spikes) that grows with depth. A room
 * gets a trap with probability `chance`.
 */
export const TRAP = {
  damage: 3,
  damagePerDepth: 1,
  chance: 0.45,
}

/** The tile offset for each direction. Origin top-left; x grows right, y down. */
export const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Compass words for the activity log. */
export const DIR_NAME: Record<Direction, string> = {
  up: 'north',
  down: 'south',
  left: 'west',
  right: 'east',
}

// ---- Map generation dimensions --------------------------------------------
//
// The level is a grid of rooms joined by corridors. Each room lives in a
// CELL×CELL slot (a MAX_ROOM interior plus one wall). Rooms vary from MIN_ROOM
// to MAX_ROOM tiles; an irregular footprint may omit cells but never shrinks
// below MIN_CELLS rooms. See `utils/generateDungeon.ts` for how these are used.
export const CELL = 8
export const MAX_ROOM = 5
export const MIN_ROOM = 3
/** Never shrink an irregular footprint below this many rooms. */
export const MIN_CELLS = 6

/** Atmospheric names for the rooms between the entrance and the vault. */
export const ROOM_NAMES = [
  'a dank chamber',
  'a mossy crypt',
  'a collapsed gallery',
  'a torch-lit hall',
  'a bone-strewn cell',
  'a flooded cavern',
]

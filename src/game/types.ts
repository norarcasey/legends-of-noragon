// Framework-free types shared by the dungeon engine and the React layer.

import type { EnemyKind } from './enemies'
import type { ItemKind } from './items'

/** A tile on the dungeon grid. Origin is top-left; x grows right, y grows down. */
export interface Point {
  x: number
  y: number
}

/** The four directions the hero can step (turn-based: one step per input). */
export type Direction = 'up' | 'down' | 'left' | 'right'

/**
 * The kinds of tile a dungeon is built from.
 *  - `wall`     — impassable.
 *  - `floor`    — walkable room interior.
 *  - `corridor` — walkable passage between rooms (not part of any room).
 *  - `door`     — walkable; the threshold where a corridor meets a room.
 *  - `chest`    — walkable; stepping onto it completes the level (loot/trap later).
 *  - `stairs`   — walkable; the way down to the next level (inert in the MVP).
 *  - `rubble`   — impassable obstacle inside a room; cover to fight around.
 *  - `merchant` — impassable; the shopkeeper. Bump it to open the shop.
 *  - `trap`     — walkable but harmful; stepping on it springs it (then clears).
 */
export type TileType =
  | 'wall'
  | 'floor'
  | 'corridor'
  | 'door'
  | 'chest'
  | 'stairs'
  | 'rubble'
  | 'merchant'
  | 'trap'

/**
 * A rectangular room, in inclusive interior tile coordinates. Enemies only act
 * while the hero shares their room, so every enemy carries the `id` of the room
 * it belongs to.
 */
export interface Room {
  id: number
  /** A short name used in the activity log, e.g. "the roost". */
  name: string
  x0: number
  y0: number
  x1: number
  y1: number
}

/** A single line in the activity log. `id` is a stable, monotonic key. */
export interface LogEntry {
  id: number
  text: string
}

/**
 * A transient floating combat number for the UI to animate and dissolve — damage
 * dealt or taken (`damage`, shown as `-N`) or healing (`heal`, shown as `+N`),
 * anchored to a grid tile. Emitted fresh each combat turn; `id` is a stable,
 * monotonic key so the renderer animates each one exactly once.
 */
export interface CombatFloat {
  id: number
  x: number
  y: number
  /** Hit points changed; `0` (and ignored) for a `miss`; the new level for `level`. */
  amount: number
  tone: 'damage' | 'heal' | 'miss' | 'level'
}

/**
 * A projectile fired this turn, for the UI to animate travelling from the
 * shooter's tile (`fromX`/`fromY`) to the target's (`toX`/`toY`) and then
 * dissolve. Emitted on a ranged shot — hit or miss — and replaced each turn;
 * `id` is a stable, monotonic key so the renderer animates each one once.
 */
export interface Projectile {
  id: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  /** What's in flight; `arrow` today, with room for bolts/spells later. */
  kind: 'arrow'
}

/** One item the hero is carrying; `id` is a stable, unique instance key. */
export interface InventoryItem {
  id: number
  kind: ItemKind
}

/** Loot lying on the dungeon floor, picked up by walking onto its tile. `kind`
 *  is `'gold'` for a coin pile (with `amount`), otherwise an item kind. */
export interface FloorItem {
  id: number
  x: number
  y: number
  kind: ItemKind | 'gold'
  amount: number
}

/** What's equipped in each slot (by inventory item id). The hero wears one
 *  weapon, one armor, one amulet, and up to two `rings` (the item ids worn). */
export interface Equipment {
  weapon: number | null
  armor: number | null
  rings: number[]
  amulet: number | null
}

/** How many ring slots the hero has. */
export const RING_SLOTS = 2

/**
 * The ways the hero can attack. Only `melee` (bump-to-attack) is wired up today;
 * `ranged` (bow/throw) and `spell` are planned and already have profiles so that
 * adding them is a data + targeting change rather than a combat-system refactor.
 */
export type AttackKind = 'melee' | 'ranged' | 'spell'

/** Tuning for one kind of attack: how often it lands and how hard it hits. */
export interface AttackProfile {
  /** Chance (0–1) that the attack lands. */
  accuracy: number
  /** Minimum damage a landed hit deals. */
  minDamage: number
  /** Maximum damage a landed hit deals. */
  maxDamage: number
}

/** The hero's full set of attack profiles, one per {@link AttackKind}. */
export type AttackProfiles = Record<AttackKind, AttackProfile>

/**
 * An enemy on the grid. For the MVP every enemy is a Bat: 1 hit point (so the
 * hero one-shots it) and it deals a flat 1 damage when it lands a hit.
 */
export interface Enemy {
  id: number
  kind: EnemyKind
  x: number
  y: number
  /** Current hit points; the enemy is removed from play at 0. */
  hp: number
  /** Maximum hit points, for the health bar on the enemy's card. */
  maxHp: number
  /** Chance (0–1) this foe lands an attack — its `ENEMY_INFO` base scaled by the
   *  depth it spawned at. */
  accuracy: number
  /** Flat damage a landed attack deals, scaled by spawn depth. */
  damage: number
  /** XP the hero earns for slaying this foe, scaled by spawn depth. */
  xp: number
  /** The room this enemy patrols; it only acts while the hero is in it. */
  room: number
}

/**
 * Lifecycle of a run:
 *  - `idle`    — dungeon is laid out, waiting for the player to begin.
 *  - `playing` — the hero is exploring/descending; each move advances a turn.
 *  - `dead`    — the hero ran out of hit points. A run is an endless descent, so
 *                death is the only end; reaching the stairs goes deeper.
 */
export type GameStatus = 'idle' | 'playing' | 'dead'

// ---- Hero stats: level- and gear-derived ----------------------------------

/**
 * The hero's level-scalable core stats: max HP and the per-kind attack profiles.
 * This is both the level-1 baseline carried across a run and the shape produced
 * once those are scaled to the current level (so stats derive from it, never
 * drifting).
 */
export interface HeroStats {
  maxHp: number
  attacks: AttackProfiles
}

/** Effective combat stats: {@link HeroStats} plus the flat armor defense from
 *  equipped gear. */
export interface CombatStats extends HeroStats {
  /** Flat damage reduction from the equipped armor. */
  defense: number
}

/** The outcome of applying earned XP: the hero's new {@link CombatStats} together
 *  with the level/XP they settle at and the HP after any level-up's full heal. */
export interface LeveledStats extends CombatStats {
  level: number
  xp: number
  hp: number
}

// ---- The generated level --------------------------------------------------

/**
 * A fully-realized dungeon level. Everything spatial lives here so it can be
 * generated per game (from the seed) and carried in state — nothing reaches for
 * a module-level map. `generateDungeon` builds it procedurally behind this shape.
 */
export interface Dungeon {
  cols: number
  rows: number
  tiles: TileType[][]
  rooms: Room[]
  playerStart: Point
  enemies: Enemy[]
  /** Loot scattered on the floor, awaiting pickup. */
  items: FloorItem[]
  /** The level's merchant, if it has one — where they stand and what they sell. */
  shop: DungeonShop | null
}

/** One item on a merchant's shelf, identified within the shop by `id`. */
export interface ShopItem {
  id: number
  kind: ItemKind
}

/** A shop placed on a level: the merchant's tile and their (initial) stock. */
export interface DungeonShop {
  /** The room the merchant occupies (kept enemy- and rubble-free). */
  room: number
  /** The merchant's tile (rendered as `merchant`; bump it to trade). */
  merchant: Point
  stock: ShopItem[]
}

// ---- The hook's options and public API ------------------------------------

export interface UseNoragonOptions {
  /** The hero's starting (and maximum) hit points. Default `6`. */
  maxHp?: number
  /** Override any attack profiles; each provided kind replaces its default.
   *  Only `melee` affects play today — `ranged`/`spell` are reserved for later. */
  attacks?: Partial<AttackProfiles>
  /** Seed for the combat RNG. Omit for a fresh random run each `start`; pass a
   *  fixed number for deterministic, reproducible combat (used in tests). */
  seed?: number
}

/** The dungeon grid the hero is exploring — dimensions, tiles, fog, and loot. */
export interface BoardView {
  /** Dungeon width in tiles. */
  cols: number
  /** Dungeon height in tiles. */
  rows: number
  /** The static tile grid, row-major (`tiles[y][x]`). */
  tiles: TileType[][]
  /** Per-tile fog-of-war mask (`visible[y][x]`): a tile is shown once a room it
   *  borders has been discovered. Undiscovered tiles render as fog. */
  visible: boolean[][]
  /** Loot lying on the current level's floor (picked up by walking onto it). */
  floorItems: FloorItem[]
}

/** The hero: where they stand, their vitals and combat stats, gear, and progress. */
export interface HeroView {
  /** The hero's tile position. */
  position: Point
  /** Current hit points. */
  hp: number
  /** Maximum hit points. */
  maxHp: number
  /** The hero's current character level (starts at 1). */
  level: number
  /** XP earned toward the next level. */
  xp: number
  /** XP required to advance from the current level to the next. */
  xpToNext: number
  /** The hero's attack profiles, one per kind, at the current level — including
   *  the equipped weapon's bonus. Only `melee`/`ranged` are used in play today. */
  attacks: AttackProfiles
  /** Flat damage reduction from the equipped armor. */
  defense: number
  /** Gold the hero is carrying. */
  gold: number
  /** Everything the hero is carrying (equipped or not). */
  inventory: InventoryItem[]
  /** Which inventory item fills each equipment slot. */
  equipment: Equipment
  /** Whether the hero is standing on a downward stairway. */
  onStairs: boolean
}

/** The run as a whole: how it's going and how far it's gotten. */
export interface RunView {
  status: GameStatus
  /** How deep the run has gone (1 at the entrance, +1 per stairway descended). */
  depth: number
  /** Enemies slain so far this level. */
  kills: number
  /** Turns the hero has taken. */
  turns: number
}

/** Everything {@link useNoragon} returns: three grouped views plus the loose
 *  combat/world state and the action callbacks. */
export interface NoragonApi {
  /** The dungeon grid: dimensions, tiles, fog mask, and floor loot. */
  board: BoardView
  /** The hero's position, vitals, combat stats, gear, and progression. */
  hero: HeroView
  /** Run-level state: status, depth, and tallies. */
  run: RunView
  /** Living enemies currently on the grid. */
  enemies: Enemy[]
  /** The subset of `enemies` that are active — sharing the hero's room. These
   *  are the ones taking turns, and the ones shown as cards. */
  activeEnemies: Enemy[]
  /** The room id the hero currently stands in, or `null` if in a doorway. */
  currentRoom: number | null
  /** Ids of rooms the hero has entered; their tiles and contents are revealed. */
  revealedRooms: number[]
  /** Whether the hero is aiming a ranged attack. */
  aiming: boolean
  /** Id of the enemy in the crosshairs while aiming, else `null`. */
  targetId: number | null
  /** Direction of an adjacent trap the hero could attempt to disarm, else `null`
   *  (drives the disarm prompt and the `E` key). */
  adjacentTrap: Direction | null
  /** A running log of what happened each turn, oldest entry first. */
  log: LogEntry[]
  /** Floating combat numbers from the latest turn (damage/heal), for the UI to
   *  animate and dissolve. Replaced each combat turn. */
  effects: CombatFloat[]
  /** Projectiles loosed on the latest turn (e.g. a fired arrow), for the UI to
   *  animate travelling to their target. Replaced each turn. */
  projectiles: Projectile[]
  /** Foes slain on the latest turn, kept for one turn so the UI can play them
   *  out (fade) where they fell rather than vanishing instantly. */
  fadingEnemies: Enemy[]
  /** Whether the shop is open (the hero bumped the merchant) — drives the
   *  shop overlay. Buying/selling is only allowed while this is `true`. */
  shopping: boolean
  /** The current merchant stock (what's left to buy), or `[]` off the shop. */
  shopStock: ShopItem[]
  /** Lay out a fresh dungeon and begin playing. */
  start: () => void
  /** Lay out a fresh dungeon without starting (returns to `idle`). */
  reset: () => void
  /** Step the hero one tile. Bumping an enemy attacks it; a wall is ignored. */
  move: (dir: Direction) => void
  /** Attempt to disarm a trap on the adjacent tile in `dir` (costs a turn). On
   *  success the trap is removed unharmed; on failure it springs for full
   *  damage. No-op if that tile isn't a trap. */
  disarm: (dir: Direction) => void
  /** Take the stairs down to the next, deeper level. No-op unless on stairs. */
  descend: () => void
  /** Equip a carried weapon or armor by its inventory item id. */
  equip: (itemId: number) => void
  /** Drink a carried potion by its inventory item id (costs a turn). */
  drink: (itemId: number) => void
  /** Discard a carried item by its inventory item id. Unequips it first if worn.
   *  Free (no turn); the item is gone for good. */
  drop: (itemId: number) => void
  /** Enter ranged-aiming mode, targeting the nearest enemy in the room. */
  aimStart: () => void
  /** While aiming, move the crosshairs to another enemy (`+1` next, `-1` prev). */
  aimCycle: (delta: number) => void
  /** Leave aiming mode without firing. */
  aimCancel: () => void
  /** Loose a ranged attack at the targeted enemy; costs the turn. */
  fire: () => void
  /** Buy a stocked item by its shop id (spends gold). Free; only while shopping. */
  buy: (stockId: number) => void
  /** Sell a carried item by its inventory id (gains gold; unequips it first if
   *  worn). Free; only while shopping. */
  sell: (itemId: number) => void
  /** Leave the merchant, closing the shop overlay. */
  closeShop: () => void
}

// ---- Engine state & actions (internal to the reducer) ---------------------

/**
 * The whole game in one object — held in a single reducer so each turn (the
 * hero's step plus every enemy's response) is one pure transition, identical
 * under StrictMode's double-invocation. Extends {@link HeroStats}, whose
 * `maxHp`/`attacks` here are the hero's *current* (leveled + geared) values;
 * `base` holds the level-1 profile they derive from.
 */
export interface GameState extends HeroStats {
  /** The run's seed; deeper levels are generated from it + their depth. */
  seed: number
  /** How deep the run is — 1 at the entrance, +1 per stairway descended. */
  depth: number
  /** The generated level for the current depth; spatial helpers read from it. */
  dungeon: Dungeon
  /** The hero's base (level-1) profile; current `maxHp`/`attacks` derive from it. */
  base: HeroStats
  /** Current character level (starts at 1). */
  level: number
  /** XP earned toward the next level. */
  xp: number
  player: Point
  hp: number
  /** Flat damage reduction from equipped armor. */
  defense: number
  /** Gold the hero is carrying. */
  gold: number
  /** Everything the hero is carrying (equipped or not). */
  inventory: InventoryItem[]
  /** Which inventory item fills each equipment slot. */
  equipment: Equipment
  /** Next id to mint for a picked-up inventory item. */
  nextItemId: number
  /** Loot still lying on this level's floor. */
  floorItems: FloorItem[]
  enemies: Enemy[]
  status: GameStatus
  kills: number
  turns: number
  revealedRooms: number[]
  log: LogEntry[]
  /** Next id to hand out for a log entry; keeps keys stable and monotonic. */
  nextLogId: number
  /** Floating combat numbers from the latest turn; replaced each combat turn. */
  effects: CombatFloat[]
  /** Projectiles loosed this turn (a fired arrow); replaced each turn. */
  projectiles: Projectile[]
  /** Foes slain this turn, kept one turn so the UI can fade them out where they
   *  fell instead of popping away. Replaced each turn. */
  fadingEnemies: Enemy[]
  /** Whether the shop overlay is open (the hero bumped the merchant). */
  shopping: boolean
  /** What the level's merchant still has for sale; drained as the hero buys. */
  shopStock: ShopItem[]
  /** Next id to mint for a combat float or projectile; monotonic so the UI
   *  animates each visual effect exactly once. */
  nextEffectId: number
  /** Current PRNG state driving combat rolls; advanced purely each transition. */
  rngState: number
  /** Whether the hero is in ranged-aiming mode (arrows cycle targets, not move). */
  aiming: boolean
  /** Id of the enemy currently in the crosshairs while aiming, else `null`. */
  targetId: number | null
  /** Tiles the hero's torch has lit (`seen[y][x]`); keeps explored corridors
   *  visible even though no room reveals them. */
  seen: boolean[][]
}

/** Every transition the reducer understands. */
export type GameAction =
  | { type: 'configure'; config: HeroStats; seed: number }
  | { type: 'reset'; seed: number }
  | { type: 'start'; seed: number }
  | { type: 'move'; dir: Direction }
  | { type: 'disarm'; dir: Direction }
  | { type: 'descend' }
  | { type: 'equip'; itemId: number }
  | { type: 'drink'; itemId: number }
  | { type: 'drop'; itemId: number }
  | { type: 'aimStart' }
  | { type: 'aimCycle'; delta: number }
  | { type: 'aimCancel' }
  | { type: 'fire' }
  | { type: 'buy'; stockId: number }
  | { type: 'sell'; itemId: number }
  | { type: 'closeShop' }

// Framework-free types shared by the dungeon engine and the React layer.

/** A tile on the dungeon grid. Origin is top-left; x grows right, y grows down. */
export interface Point {
  x: number
  y: number
}

/** The four directions the hero can step (turn-based: one step per input). */
export type Direction = 'up' | 'down' | 'left' | 'right'

/**
 * The kinds of tile the hardcoded dungeon is built from. Future procedurally
 * generated levels will reuse the same vocabulary.
 *  - `wall`   — impassable.
 *  - `floor`  — walkable.
 *  - `door`   — walkable; connects two rooms.
 *  - `chest`  — walkable; stepping onto it completes the level (loot/trap later).
 *  - `stairs` — walkable; the way down to the next level (inert in the MVP).
 */
export type TileType = 'wall' | 'floor' | 'door' | 'chest' | 'stairs'

/**
 * A rectangular room, in inclusive interior tile coordinates. Enemies only act
 * while the hero shares their room, so every enemy carries the `id` of the room
 * it belongs to.
 */
export interface Room {
  id: number
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * An enemy on the grid. For the MVP every enemy is a Bat: 1 hit point (so the
 * hero one-shots it) and it deals a flat 1 damage when it lands a hit.
 */
export interface Enemy {
  id: number
  kind: 'bat'
  x: number
  y: number
  /** Current hit points; the enemy is removed from play at 0. */
  hp: number
  /** The room this enemy patrols; it only acts while the hero is in it. */
  room: number
}

/**
 * Lifecycle of a single level:
 *  - `idle`    — dungeon is laid out, waiting for the player to begin.
 *  - `playing` — the hero is exploring; each move advances a turn.
 *  - `won`     — the hero reached the chest and completed the level.
 *  - `dead`    — the hero ran out of hit points.
 */
export type GameStatus = 'idle' | 'playing' | 'won' | 'dead'

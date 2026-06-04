import { useCallback, useEffect, useReducer } from 'react'
import type { Direction, Enemy, GameStatus, Point, Room, TileType } from './types'

export interface UseNoragonOptions {
  /** The hero's starting (and maximum) hit points. Default `6`. */
  maxHp?: number
}

export interface NoragonApi {
  /** Dungeon width in tiles. */
  cols: number
  /** Dungeon height in tiles. */
  rows: number
  /** The static tile grid, row-major (`tiles[y][x]`). */
  tiles: TileType[][]
  /** The hero's position. */
  player: Point
  /** Current hit points. */
  hp: number
  /** Maximum hit points. */
  maxHp: number
  /** Stamina pool — displayed only in the MVP; it does not gate movement yet. */
  stamina: number
  /** Maximum stamina. */
  maxStamina: number
  /** The hero's attack rating; high enough to one-shot a bat in the MVP. */
  attack: number
  /** Living enemies currently on the grid. */
  enemies: Enemy[]
  status: GameStatus
  /** Enemies slain so far this level. */
  kills: number
  /** Turns the hero has taken. */
  turns: number
  /** The room id the hero currently stands in, or `null` if in a doorway. */
  currentRoom: number | null
  /** Lay out a fresh dungeon and begin playing. */
  start: () => void
  /** Lay out a fresh dungeon without starting (returns to `idle`). */
  reset: () => void
  /** Step the hero one tile. Bumping an enemy attacks it; a wall is ignored. */
  move: (dir: Direction) => void
}

const DEFAULTS = { maxHp: 6, attack: 5, maxStamina: 10 }

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

// ---- The hardcoded first dungeon ------------------------------------------
//
// Three rooms in a row, joined by doorways. The first room is empty, the middle
// room holds two bats, and the last room holds the chest (step on it to win)
// plus a stairway down (inert in the MVP). A future feature will generate this
// layout — and place monsters — procedurally; for now it is a fixed map.
//
//   #  wall      .  floor    +  door
//   @  hero start (becomes floor)      b  bat (becomes floor)
//   C  chest     >  stairs down
const LAYOUT = [
  '###################',
  '#.....#.....#.....#',
  '#.....#.b...#.....#',
  '#@....+.....+..C>.#',
  '#.....#...b.#.....#',
  '#.....#.....#.....#',
  '###################',
]

// The three rooms, in inclusive interior coordinates. Walls sit on the borders
// and at the shared columns (x = 6, 12); the doorways punch through those.
const ROOMS: Room[] = [
  { id: 0, x0: 1, y0: 1, x1: 5, y1: 5 },
  { id: 1, x0: 7, y0: 1, x1: 11, y1: 5 },
  { id: 2, x0: 13, y0: 1, x1: 17, y1: 5 },
]

interface Dungeon {
  cols: number
  rows: number
  tiles: TileType[][]
  playerStart: Point
  enemies: Enemy[]
}

/** Parse {@link LAYOUT} once into a structured dungeon the reducer can clone. */
function parseDungeon(): Dungeon {
  const rows = LAYOUT.length
  const cols = LAYOUT[0].length
  const tiles: TileType[][] = []
  const enemies: Enemy[] = []
  let playerStart: Point = { x: 1, y: 1 }
  let enemyId = 0

  for (let y = 0; y < rows; y++) {
    const row: TileType[] = []
    for (let x = 0; x < cols; x++) {
      const ch = LAYOUT[y][x]
      switch (ch) {
        case '#':
          row.push('wall')
          break
        case '+':
          row.push('door')
          break
        case 'C':
          row.push('chest')
          break
        case '>':
          row.push('stairs')
          break
        case '@':
          playerStart = { x, y }
          row.push('floor')
          break
        case 'b':
          enemies.push({ id: enemyId++, kind: 'bat', x, y, hp: 1, room: roomAt(x, y) ?? 0 })
          row.push('floor')
          break
        default:
          row.push('floor')
      }
    }
    tiles.push(row)
  }

  return { cols, rows, tiles, playerStart, enemies }
}

/** The room containing a tile, or `null` for walls / doorways between rooms. */
function roomAt(x: number, y: number): number | null {
  for (const r of ROOMS) {
    if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.id
  }
  return null
}

// Parsed once at module load. `tiles` is never mutated, so every game can share
// the same reference; the mutable bits (hero, enemies) are copied per game.
const DUNGEON = parseDungeon()

// The whole level lives in one reducer, so each turn — the hero's step plus
// every enemy's response — is computed from the previous state in a single pure
// transition. That keeps it correct under StrictMode's double-invocation, the
// same discipline that the other games in this family rely on.
interface GameState {
  player: Point
  hp: number
  maxHp: number
  stamina: number
  maxStamina: number
  attack: number
  enemies: Enemy[]
  status: GameStatus
  kills: number
  turns: number
}

type GameAction =
  | { type: 'configure'; maxHp: number }
  | { type: 'reset' }
  | { type: 'start' }
  | { type: 'move'; dir: Direction }

function makeInitial(maxHp: number): GameState {
  return {
    player: { ...DUNGEON.playerStart },
    hp: maxHp,
    maxHp,
    stamina: DEFAULTS.maxStamina,
    maxStamina: DEFAULTS.maxStamina,
    attack: DEFAULTS.attack,
    enemies: DUNGEON.enemies.map((e) => ({ ...e })),
    status: 'idle',
    kills: 0,
    turns: 0,
  }
}

function tileAt(x: number, y: number): TileType {
  if (y < 0 || y >= DUNGEON.rows || x < 0 || x >= DUNGEON.cols) return 'wall'
  return DUNGEON.tiles[y][x]
}

/** Choose a bat's next tile: one orthogonal step toward the hero, staying inside
 *  its room and off any occupied tile. Returns the bat's current tile if boxed in. */
function chaseStep(bat: Enemy, target: Point, occupied: Set<string>): Point {
  const room = ROOMS[bat.room]
  const dx = target.x - bat.x
  const dy = target.y - bat.y
  const horiz: Point | null = dx !== 0 ? { x: bat.x + Math.sign(dx), y: bat.y } : null
  const vert: Point | null = dy !== 0 ? { x: bat.x, y: bat.y + Math.sign(dy) } : null
  // Try to close the larger gap first; fall back to the other axis if blocked.
  const candidates = Math.abs(dx) >= Math.abs(dy) ? [horiz, vert] : [vert, horiz]

  for (const c of candidates) {
    if (!c) continue
    const inRoom = c.x >= room.x0 && c.x <= room.x1 && c.y >= room.y0 && c.y <= room.y1
    if (inRoom && !occupied.has(`${c.x},${c.y}`)) return c
  }
  return { x: bat.x, y: bat.y }
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'configure':
      return makeInitial(action.maxHp)
    case 'reset':
      return makeInitial(state.maxHp)
    case 'start':
      return { ...makeInitial(state.maxHp), status: 'playing' }
    case 'move': {
      if (state.status !== 'playing') return state

      const delta = DELTA[action.dir]
      const target = { x: state.player.x + delta.x, y: state.player.y + delta.y }
      const targetBat = state.enemies.find((e) => e.x === target.x && e.y === target.y)

      let player = state.player
      let enemies = state.enemies
      let kills = state.kills

      if (targetBat) {
        // Bump-to-attack. The hero's rating one-shots a bat in the MVP, so the
        // hit always lands and the bat is removed; the hero holds its ground.
        enemies = state.enemies
          .map((e) => (e.id === targetBat.id ? { ...e, hp: e.hp - state.attack } : e))
          .filter((e) => e.hp > 0)
        kills = state.kills + (enemies.length < state.enemies.length ? 1 : 0)
      } else if (tileAt(target.x, target.y) === 'wall') {
        // Bumping a wall is not a turn — nothing happens.
        return state
      } else {
        player = target
        // Stepping onto the chest completes the level before enemies act.
        if (tileAt(target.x, target.y) === 'chest') {
          return { ...state, player, status: 'won', turns: state.turns + 1 }
        }
      }

      // ---- Enemy phase: bats in the hero's room take one action each. -------
      const room = roomAt(player.x, player.y)
      let hp = state.hp
      const occupied = new Set(enemies.map((e) => `${e.x},${e.y}`))
      const moved: Enemy[] = []

      for (const bat of enemies) {
        if (bat.room !== room) {
          moved.push(bat)
          continue
        }
        const manhattan = Math.abs(bat.x - player.x) + Math.abs(bat.y - player.y)
        if (manhattan === 1) {
          // Adjacent: the bat lands a hit for a flat 1 damage.
          hp -= 1
          moved.push(bat)
          continue
        }
        // Otherwise chase. Reserve the destination so two bats can't stack.
        occupied.delete(`${bat.x},${bat.y}`)
        const step = chaseStep(bat, player, occupied)
        occupied.add(`${step.x},${step.y}`)
        moved.push({ ...bat, x: step.x, y: step.y })
      }

      const status: GameStatus = hp <= 0 ? 'dead' : 'playing'
      return {
        ...state,
        player,
        hp: Math.max(0, hp),
        enemies: moved,
        kills,
        status,
        turns: state.turns + 1,
      }
    }
  }
}

export function useNoragon(options: UseNoragonOptions = {}): NoragonApi {
  const maxHp = options.maxHp ?? DEFAULTS.maxHp

  const [state, dispatch] = useReducer(reducer, undefined, () => makeInitial(maxHp))

  // Re-lay the dungeon whenever the hero's max HP changes.
  useEffect(() => {
    dispatch({ type: 'configure', maxHp })
  }, [maxHp])

  const start = useCallback(() => dispatch({ type: 'start' }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])
  const move = useCallback((dir: Direction) => dispatch({ type: 'move', dir }), [])

  return {
    cols: DUNGEON.cols,
    rows: DUNGEON.rows,
    tiles: DUNGEON.tiles,
    player: state.player,
    hp: state.hp,
    maxHp: state.maxHp,
    stamina: state.stamina,
    maxStamina: state.maxStamina,
    attack: state.attack,
    enemies: state.enemies,
    status: state.status,
    kills: state.kills,
    turns: state.turns,
    currentRoom: roomAt(state.player.x, state.player.y),
    start,
    reset,
    move,
  }
}

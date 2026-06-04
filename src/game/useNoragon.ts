import { useCallback, useEffect, useReducer } from 'react'
import type { Direction, Enemy, GameStatus, LogEntry, Point, Room, TileType } from './types'
import { ENEMY_INFO } from './enemies'

export interface UseNoragonOptions {
  /** The hero's starting (and maximum) hit points. Default `6`. */
  maxHp?: number
  /** Chance (0–1) that a hero melee swing lands. Default `0.8`. */
  accuracy?: number
  /** Minimum damage a landed hero hit deals. Default `2`. */
  minDamage?: number
  /** Maximum damage a landed hero hit deals. Default `5`. */
  maxDamage?: number
  /** Seed for the combat RNG. Omit for a fresh random run each `start`; pass a
   *  fixed number for deterministic, reproducible combat (used in tests). */
  seed?: number
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
  /** Chance (0–1) that a hero melee swing lands. */
  accuracy: number
  /** Minimum damage a landed hero hit deals. */
  minDamage: number
  /** Maximum damage a landed hero hit deals. */
  maxDamage: number
  /** Living enemies currently on the grid. */
  enemies: Enemy[]
  /** The subset of `enemies` that are active — sharing the hero's room. These
   *  are the ones taking turns, and the ones shown as cards. */
  activeEnemies: Enemy[]
  status: GameStatus
  /** Enemies slain so far this level. */
  kills: number
  /** Turns the hero has taken. */
  turns: number
  /** The room id the hero currently stands in, or `null` if in a doorway. */
  currentRoom: number | null
  /** A running log of what happened each turn, oldest entry first. */
  log: LogEntry[]
  /** Ids of rooms the hero has entered; their tiles and contents are revealed. */
  revealedRooms: number[]
  /** Per-tile fog-of-war mask (`visible[y][x]`): a tile is shown once a room it
   *  borders has been discovered. Undiscovered tiles render as fog. */
  visible: boolean[][]
  /** Lay out a fresh dungeon and begin playing. */
  start: () => void
  /** Lay out a fresh dungeon without starting (returns to `idle`). */
  reset: () => void
  /** Step the hero one tile. Bumping an enemy attacks it; a wall is ignored. */
  move: (dir: Direction) => void
}

const DEFAULTS = { maxHp: 6, accuracy: 0.8, minDamage: 2, maxDamage: 5, maxStamina: 10 }

/** Chance (0–1) that a bat lands its bite when adjacent. */
const BAT_ACCURACY = 0.6

/**
 * A small deterministic PRNG (mulberry32). Kept pure and seeded from state so
 * the reducer stays a pure function of (state, action) — identical results under
 * StrictMode's double-invocation, and reproducible from a seed in tests.
 */
function nextRng(seed: number): { value: number; state: number } {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, state: t >>> 0 }
}

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Compass words for the activity log. */
const DIR_NAME: Record<Direction, string> = {
  up: 'north',
  down: 'south',
  left: 'west',
  right: 'east',
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
  { id: 0, name: 'the entry hall', x0: 1, y0: 1, x1: 5, y1: 5 },
  { id: 1, name: 'the roost', x0: 7, y0: 1, x1: 11, y1: 5 },
  { id: 2, name: 'the vault', x0: 13, y0: 1, x1: 17, y1: 5 },
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
          enemies.push({
            id: enemyId++,
            kind: 'bat',
            x,
            y,
            hp: 3,
            maxHp: 3,
            room: roomAt(x, y) ?? 0,
          })
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

/** Add `room` to the revealed set (returning the same array if already known). */
function reveal(revealedRooms: number[], room: number | null): number[] {
  if (room === null || revealedRooms.includes(room)) return revealedRooms
  return [...revealedRooms, room]
}

/**
 * Build the fog-of-war mask for a set of revealed rooms. A tile is visible when
 * it falls within a revealed room's interior *or* the ring of walls/doorways
 * around it — so entering a room lights up the room, its walls, and the doors
 * out of it, while everything beyond stays dark until you cross the threshold.
 */
function computeVisible(revealedRooms: number[]): boolean[][] {
  const grid: boolean[][] = DUNGEON.tiles.map((row) => row.map(() => false))
  for (const id of revealedRooms) {
    const r = ROOMS[id]
    for (let y = r.y0 - 1; y <= r.y1 + 1; y++) {
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        if (y >= 0 && y < DUNGEON.rows && x >= 0 && x < DUNGEON.cols) grid[y][x] = true
      }
    }
  }
  return grid
}

// Parsed once at module load. `tiles` is never mutated, so every game can share
// the same reference; the mutable bits (hero, enemies) are copied per game.
const DUNGEON = parseDungeon()

// The whole level lives in one reducer, so each turn — the hero's step plus
// every enemy's response — is computed from the previous state in a single pure
// transition. That keeps it correct under StrictMode's double-invocation, the
// same discipline that the other games in this family rely on.
/** The hero's tunable combat profile, carried so reset/start can rebuild it. */
interface HeroConfig {
  maxHp: number
  accuracy: number
  minDamage: number
  maxDamage: number
}

interface GameState extends HeroConfig {
  player: Point
  hp: number
  stamina: number
  maxStamina: number
  enemies: Enemy[]
  status: GameStatus
  kills: number
  turns: number
  revealedRooms: number[]
  log: LogEntry[]
  /** Next id to hand out for a log entry; keeps keys stable and monotonic. */
  nextLogId: number
  /** Current PRNG state driving combat rolls; advanced purely each transition. */
  rngState: number
}

type GameAction =
  | { type: 'configure'; config: HeroConfig; seed: number }
  | { type: 'reset'; seed: number }
  | { type: 'start'; seed: number }
  | { type: 'move'; dir: Direction }

function makeInitial(config: HeroConfig, seed: number): GameState {
  return {
    ...config,
    player: { ...DUNGEON.playerStart },
    hp: config.maxHp,
    stamina: DEFAULTS.maxStamina,
    maxStamina: DEFAULTS.maxStamina,
    enemies: DUNGEON.enemies.map((e) => ({ ...e })),
    status: 'idle',
    kills: 0,
    turns: 0,
    // The hero can already see the room they start in.
    revealedRooms: reveal([], roomAt(DUNGEON.playerStart.x, DUNGEON.playerStart.y)),
    log: [],
    nextLogId: 0,
    rngState: seed >>> 0,
  }
}

/** Pull the hero's combat profile back out of a live game state. */
function configOf(state: GameState): HeroConfig {
  return {
    maxHp: state.maxHp,
    accuracy: state.accuracy,
    minDamage: state.minDamage,
    maxDamage: state.maxDamage,
  }
}

/** Append messages to the log, minting a stable id for each. Pure. */
function logLines(
  log: LogEntry[],
  nextLogId: number,
  messages: string[],
): { log: LogEntry[]; nextLogId: number } {
  if (messages.length === 0) return { log, nextLogId }
  const added = messages.map((text, i) => ({ id: nextLogId + i, text }))
  return { log: [...log, ...added], nextLogId: nextLogId + messages.length }
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
      return makeInitial(action.config, action.seed)
    case 'reset':
      return makeInitial(configOf(state), action.seed)
    case 'start': {
      const fresh = makeInitial(configOf(state), action.seed)
      const room = roomAt(fresh.player.x, fresh.player.y)
      const opening = [
        'You descend into the dungeon of Noragon.',
        room !== null ? `You enter ${ROOMS[room].name}.` : 'You press into the dark.',
      ]
      return { ...fresh, status: 'playing', ...logLines(fresh.log, fresh.nextLogId, opening) }
    }
    case 'move': {
      if (state.status !== 'playing') return state

      const delta = DELTA[action.dir]
      const target = { x: state.player.x + delta.x, y: state.player.y + delta.y }
      const targetBat = state.enemies.find((e) => e.x === target.x && e.y === target.y)

      let player = state.player
      let enemies = state.enemies
      let kills = state.kills
      const messages: string[] = []

      // All combat randomness flows through this one advancing seed, so the
      // whole turn stays a pure function of (state, action).
      let rngState = state.rngState
      const roll = () => {
        const r = nextRng(rngState)
        rngState = r.state
        return r.value
      }

      if (targetBat) {
        // Bump-to-attack: roll the hero's melee chance, then variable damage.
        const name = ENEMY_INFO[targetBat.kind].name
        if (roll() < state.accuracy) {
          const span = state.maxDamage - state.minDamage + 1
          const damage = state.minDamage + Math.floor(roll() * span)
          enemies = state.enemies
            .map((e) => (e.id === targetBat.id ? { ...e, hp: e.hp - damage } : e))
            .filter((e) => e.hp > 0)
          const slain = enemies.length < state.enemies.length
          kills = state.kills + (slain ? 1 : 0)
          messages.push(
            slain
              ? `You strike the ${name} for ${damage} — slain!`
              : `You strike the ${name} for ${damage}.`,
          )
        } else {
          messages.push(`You swing at the ${name} and miss.`)
        }
      } else if (tileAt(target.x, target.y) === 'wall') {
        // Bumping a wall is not a turn — nothing happens, and nothing is logged.
        return state
      } else {
        player = target
        messages.push(`You move ${DIR_NAME[action.dir]}.`)
        // Stepping onto the chest completes the level before enemies act.
        if (tileAt(target.x, target.y) === 'chest') {
          messages.push('You reach the chest. The level is cleared!')
          return {
            ...state,
            player,
            status: 'won',
            turns: state.turns + 1,
            revealedRooms: reveal(state.revealedRooms, roomAt(player.x, player.y)),
            ...logLines(state.log, state.nextLogId, messages),
          }
        }
        // Announce crossing into a room the hero hasn't been in before.
        const steppedInto = roomAt(player.x, player.y)
        if (steppedInto !== null && !state.revealedRooms.includes(steppedInto)) {
          messages.push(`You enter ${ROOMS[steppedInto].name}.`)
        }
      }

      // Light up the room the hero just stepped into (a no-op if already known).
      const revealedRooms = reveal(state.revealedRooms, roomAt(player.x, player.y))

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
          // Adjacent: the bat rolls to land its bite for a flat 1 damage.
          const name = ENEMY_INFO[bat.kind].name
          if (roll() < BAT_ACCURACY) {
            hp -= 1
            messages.push(`The ${name} bites you for 1.`)
          } else {
            messages.push(`The ${name} swoops at you but misses.`)
          }
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
      if (status === 'dead') messages.push('You collapse, slain in the dark.')

      return {
        ...state,
        player,
        hp: Math.max(0, hp),
        enemies: moved,
        kills,
        status,
        turns: state.turns + 1,
        revealedRooms,
        rngState,
        ...logLines(state.log, state.nextLogId, messages),
      }
    }
  }
}

export function useNoragon(options: UseNoragonOptions = {}): NoragonApi {
  const maxHp = options.maxHp ?? DEFAULTS.maxHp
  const accuracy = options.accuracy ?? DEFAULTS.accuracy
  const minDamage = options.minDamage ?? DEFAULTS.minDamage
  const maxDamage = options.maxDamage ?? DEFAULTS.maxDamage
  const seed = options.seed

  // A fixed `seed` makes every run reproducible; otherwise each (re)start draws
  // a fresh random seed. Generated outside the reducer so the reducer stays pure.
  const makeSeed = useCallback(() => seed ?? Math.floor(Math.random() * 0x7fffffff), [seed])

  const [state, dispatch] = useReducer(reducer, undefined, () =>
    makeInitial({ maxHp, accuracy, minDamage, maxDamage }, seed ?? 1),
  )

  // Re-lay the dungeon whenever the hero's combat profile changes.
  useEffect(() => {
    dispatch({
      type: 'configure',
      config: { maxHp, accuracy, minDamage, maxDamage },
      seed: makeSeed(),
    })
  }, [maxHp, accuracy, minDamage, maxDamage, makeSeed])

  const start = useCallback(() => dispatch({ type: 'start', seed: makeSeed() }), [makeSeed])
  const reset = useCallback(() => dispatch({ type: 'reset', seed: makeSeed() }), [makeSeed])
  const move = useCallback((dir: Direction) => dispatch({ type: 'move', dir }), [])

  // Enemies are "active" only while the hero shares their room — the same rule
  // that governs whether they take turns. Those are the ones we surface as cards.
  const currentRoom = roomAt(state.player.x, state.player.y)
  const activeEnemies = state.enemies.filter((e) => e.room === currentRoom)

  return {
    cols: DUNGEON.cols,
    rows: DUNGEON.rows,
    tiles: DUNGEON.tiles,
    player: state.player,
    hp: state.hp,
    maxHp: state.maxHp,
    stamina: state.stamina,
    maxStamina: state.maxStamina,
    accuracy: state.accuracy,
    minDamage: state.minDamage,
    maxDamage: state.maxDamage,
    enemies: state.enemies,
    activeEnemies,
    status: state.status,
    kills: state.kills,
    turns: state.turns,
    currentRoom,
    log: state.log,
    revealedRooms: state.revealedRooms,
    visible: computeVisible(state.revealedRooms),
    start,
    reset,
    move,
  }
}

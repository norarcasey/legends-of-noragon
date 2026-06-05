import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type {
  AttackProfile,
  AttackProfiles,
  Direction,
  Enemy,
  GameStatus,
  LogEntry,
  Point,
  Room,
  TileType,
} from './types'
import { ENEMY_INFO } from './enemies'
import type { EnemyKind } from './enemies'

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
  /** The hero's attack profiles, one per kind. Only `melee` is used in play
   *  today; `ranged`/`spell` are present for forthcoming attack modes. */
  attacks: AttackProfiles
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
  /** Whether the hero is aiming a ranged attack. */
  aiming: boolean
  /** Id of the enemy in the crosshairs while aiming, else `null`. */
  targetId: number | null
  /** Lay out a fresh dungeon and begin playing. */
  start: () => void
  /** Lay out a fresh dungeon without starting (returns to `idle`). */
  reset: () => void
  /** Step the hero one tile. Bumping an enemy attacks it; a wall is ignored. */
  move: (dir: Direction) => void
  /** Enter ranged-aiming mode, targeting the nearest enemy in the room. */
  aimStart: () => void
  /** While aiming, move the crosshairs to another enemy (`+1` next, `-1` prev). */
  aimCycle: (delta: number) => void
  /** Leave aiming mode without firing. */
  aimCancel: () => void
  /** Loose a ranged attack at the targeted enemy; costs the turn. */
  fire: () => void
}

const DEFAULTS = { maxHp: 12 }

/**
 * Default attack profiles. `melee` drives the current bump-to-attack; `ranged`
 * and `spell` are tuned and ready but not yet wired to a targeting action.
 */
const DEFAULT_ATTACKS: AttackProfiles = {
  melee: { accuracy: 0.8, minDamage: 3, maxDamage: 6 },
  ranged: { accuracy: 0.6, minDamage: 2, maxDamage: 4 },
  spell: { accuracy: 0.9, minDamage: 3, maxDamage: 6 },
}

/**
 * Resolve one attack against a profile, drawing from `roll`: first the to-hit
 * check, then (on a hit) the damage within the profile's range. Generic over
 * attack kind, so melee/ranged/spell all share this once they're wired up.
 */
function resolveAttack(
  profile: AttackProfile,
  roll: () => number,
): { hit: boolean; damage: number } {
  if (roll() >= profile.accuracy) return { hit: false, damage: 0 }
  const span = profile.maxDamage - profile.minDamage + 1
  return { hit: true, damage: profile.minDamage + Math.floor(roll() * span) }
}

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

// ---- Procedural dungeon generation ----------------------------------------
//
// The level is a grid of rooms joined by doorways. A seeded RNG carves a
// spanning set of doors (so every room is reachable), picks a start room and the
// farthest room for the chest, and scatters enemies by depth. Rooms-on-a-grid
// keeps today's room model — fog of war, enemy confinement, and activation are
// all keyed on rooms — while making every run different.

/** Rooms across and down, and each room's interior size (in tiles). */
const GRID_COLS = 3
const GRID_ROWS = 2
const ROOM_W = 5
const ROOM_H = 5

/** Atmospheric names for the rooms between the entrance and the vault. */
const ROOM_NAMES = [
  'a dank chamber',
  'a mossy crypt',
  'a collapsed gallery',
  'a torch-lit hall',
  'a bone-strewn cell',
  'a flooded cavern',
]

/** A tiny seeded RNG built on {@link nextRng}, for layout generation. */
function makeRng(seed: number) {
  let s = seed >>> 0
  const next = () => {
    const r = nextRng(s)
    s = r.state
    return r.value
  }
  return { next, int: (n: number) => Math.floor(next() * n) }
}

/**
 * A fully-realized dungeon level. Everything spatial lives here so it can be
 * generated per game (from the seed) and carried in state — nothing reaches for
 * a module-level map. Today {@link generateDungeon} emits a fixed layout; a
 * future version will build it procedurally behind this same shape.
 */
interface Dungeon {
  cols: number
  rows: number
  tiles: TileType[][]
  rooms: Room[]
  playerStart: Point
  enemies: Enemy[]
}

/** The room containing a tile, or `null` for walls / doorways between rooms. */
function roomAt(rooms: Room[], x: number, y: number): number | null {
  for (const r of rooms) {
    if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.id
  }
  return null
}

/** Spawn an enemy of `kind` at full health for the tile it was placed on. */
function spawnEnemy(rooms: Room[], kind: EnemyKind, id: number, x: number, y: number): Enemy {
  const { maxHp } = ENEMY_INFO[kind]
  return { id, kind, x, y, hp: maxHp, maxHp, room: roomAt(rooms, x, y) ?? 0 }
}

/**
 * Build the dungeon for a run from `seed`: carve a grid of rooms, connect them
 * with a random spanning set of doors (plus a few loops), drop the chest in the
 * farthest room, and scatter enemies by depth — the start room stays safe and
 * the vault is guarded. Deterministic: the same seed always yields the same map.
 */
function generateDungeon(seed: number): Dungeon {
  // A stream distinct from the combat RNG (which is seeded directly from `seed`).
  const rng = makeRng((seed ^ 0x9e3779b9) >>> 0)
  const cols = GRID_COLS * (ROOM_W + 1) + 1
  const rows = GRID_ROWS * (ROOM_H + 1) + 1
  const cellCount = GRID_COLS * GRID_ROWS

  // Start every tile as wall; rooms and doors are carved into it.
  const tiles: TileType[][] = []
  for (let y = 0; y < rows; y++) {
    const row: TileType[] = []
    for (let x = 0; x < cols; x++) row.push('wall')
    tiles.push(row)
  }

  const rectOf = (cell: number) => {
    const gx = cell % GRID_COLS
    const gy = Math.floor(cell / GRID_COLS)
    const x0 = gx * (ROOM_W + 1) + 1
    const y0 = gy * (ROOM_H + 1) + 1
    return { gx, gy, x0, y0, x1: x0 + ROOM_W - 1, y1: y0 + ROOM_H - 1 }
  }
  const centerOf = (cell: number): Point => {
    const r = rectOf(cell)
    return { x: Math.floor((r.x0 + r.x1) / 2), y: Math.floor((r.y0 + r.y1) / 2) }
  }

  // Carve each room's interior to floor.
  for (let cell = 0; cell < cellCount; cell++) {
    const r = rectOf(cell)
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) tiles[y][x] = 'floor'
    }
  }

  const neighbors = (cell: number): number[] => {
    const gx = cell % GRID_COLS
    const gy = Math.floor(cell / GRID_COLS)
    const out: number[] = []
    if (gx > 0) out.push(cell - 1)
    if (gx < GRID_COLS - 1) out.push(cell + 1)
    if (gy > 0) out.push(cell - GRID_COLS)
    if (gy < GRID_ROWS - 1) out.push(cell + GRID_COLS)
    return out
  }

  // Track which cells are linked so we can BFS over doors and avoid duplicates.
  const links: Set<number>[] = []
  for (let i = 0; i < cellCount; i++) links.push(new Set<number>())
  const carveDoor = (a: number, b: number) => {
    if (links[a].has(b)) return
    links[a].add(b)
    links[b].add(a)
    const ra = rectOf(a)
    const rb = rectOf(b)
    if (ra.gy === rb.gy) {
      // Horizontal neighbours: door on the shared column, a random shared row.
      tiles[ra.y0 + rng.int(ROOM_H)][Math.min(ra.x1, rb.x1) + 1] = 'door'
    } else {
      // Vertical neighbours: door on the shared row, a random shared column.
      tiles[Math.min(ra.y1, rb.y1) + 1][ra.x0 + rng.int(ROOM_W)] = 'door'
    }
  }

  // Spanning tree via randomized DFS, so every room is reachable.
  const startCell = rng.int(cellCount)
  const visited = new Set<number>([startCell])
  const stack = [startCell]
  while (stack.length) {
    const cur = stack[stack.length - 1]
    const open = neighbors(cur).filter((n) => !visited.has(n))
    if (open.length === 0) {
      stack.pop()
      continue
    }
    const next = open[rng.int(open.length)]
    carveDoor(cur, next)
    visited.add(next)
    stack.push(next)
  }

  // A few extra doors for loops, so it isn't a pure tree.
  for (let cell = 0; cell < cellCount; cell++) {
    for (const n of neighbors(cell)) {
      if (n > cell && !links[cell].has(n) && rng.next() < 0.25) carveDoor(cell, n)
    }
  }

  // BFS distances from the start cell over the carved doors.
  const dist = new Array<number>(cellCount).fill(-1)
  dist[startCell] = 0
  const queue = [startCell]
  for (let i = 0; i < queue.length; i++) {
    for (const n of links[queue[i]]) {
      if (dist[n] === -1) {
        dist[n] = dist[queue[i]] + 1
        queue.push(n)
      }
    }
  }

  // The chest goes in the farthest room (ties broken by lowest cell id).
  let chestCell = startCell
  for (let cell = 0; cell < cellCount; cell++) {
    if (dist[cell] > dist[chestCell]) chestCell = cell
  }

  // Name and record every room.
  const rooms: Room[] = []
  let nameIdx = 0
  for (let cell = 0; cell < cellCount; cell++) {
    const r = rectOf(cell)
    const name =
      cell === startCell
        ? 'the entry hall'
        : cell === chestCell
          ? 'the vault'
          : ROOM_NAMES[nameIdx++ % ROOM_NAMES.length]
    rooms.push({ id: cell, name, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 })
  }

  const playerStart = centerOf(startCell)

  // Place the chest (the win tile) and an inert stairway beside it.
  const chestAt = centerOf(chestCell)
  tiles[chestAt.y][chestAt.x] = 'chest'
  if (chestAt.x + 1 <= rectOf(chestCell).x1) tiles[chestAt.y][chestAt.x + 1] = 'stairs'

  // Scatter enemies by depth onto free interior floor tiles.
  const taken = new Set<string>([`${playerStart.x},${playerStart.y}`])
  const enemies: Enemy[] = []
  let enemyId = 0
  const placeIn = (cell: number, kinds: EnemyKind[]) => {
    const r = rectOf(cell)
    const free: Point[] = []
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        if (tiles[y][x] === 'floor' && !taken.has(`${x},${y}`)) free.push({ x, y })
      }
    }
    for (const kind of kinds) {
      if (free.length === 0) break
      const spot = free.splice(rng.int(free.length), 1)[0]
      taken.add(`${spot.x},${spot.y}`)
      enemies.push(spawnEnemy(rooms, kind, enemyId++, spot.x, spot.y))
    }
  }
  for (let cell = 0; cell < cellCount; cell++) {
    if (cell === startCell) continue
    if (cell === chestCell) {
      placeIn(cell, ['goblin', 'bat']) // guarded loot
      continue
    }
    const d = dist[cell]
    const kinds: EnemyKind[] = d >= 3 ? ['bat', 'goblin'] : d === 2 ? ['bat', 'bat'] : ['bat']
    placeIn(cell, kinds)
  }

  return { cols, rows, tiles, rooms, playerStart, enemies }
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
function computeVisible(dungeon: Dungeon, revealedRooms: number[]): boolean[][] {
  const grid: boolean[][] = dungeon.tiles.map((row) => row.map(() => false))
  for (const id of revealedRooms) {
    const r = dungeon.rooms[id]
    for (let y = r.y0 - 1; y <= r.y1 + 1; y++) {
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        if (y >= 0 && y < dungeon.rows && x >= 0 && x < dungeon.cols) grid[y][x] = true
      }
    }
  }
  return grid
}

/** Rooms an orthogonal step from a door tile — so a hero standing in the doorway
 *  can see into the room beyond (and any foe waiting just inside). Empty off a door. */
function roomsByDoor(dungeon: Dungeon, p: Point): number[] {
  if (tileAt(dungeon, p.x, p.y) !== 'door') return []
  const out: number[] = []
  for (const d of Object.values(DELTA)) {
    const room = roomAt(dungeon.rooms, p.x + d.x, p.y + d.y)
    if (room !== null) out.push(room)
  }
  return out
}

// The whole level lives in one reducer, so each turn — the hero's step plus
// every enemy's response — is computed from the previous state in a single pure
// transition. That keeps it correct under StrictMode's double-invocation, the
// same discipline that the other games in this family rely on.
/** The hero's tunable profile, carried so reset/start can rebuild it. */
interface HeroConfig {
  maxHp: number
  attacks: AttackProfiles
}

interface GameState extends HeroConfig {
  /** The generated level for this run; spatial helpers read from it. */
  dungeon: Dungeon
  player: Point
  hp: number
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
  /** Whether the hero is in ranged-aiming mode (arrows cycle targets, not move). */
  aiming: boolean
  /** Id of the enemy currently in the crosshairs while aiming, else `null`. */
  targetId: number | null
}

type GameAction =
  | { type: 'configure'; config: HeroConfig; seed: number }
  | { type: 'reset'; seed: number }
  | { type: 'start'; seed: number }
  | { type: 'move'; dir: Direction }
  | { type: 'aimStart' }
  | { type: 'aimCycle'; delta: number }
  | { type: 'aimCancel' }
  | { type: 'fire' }

function makeInitial(config: HeroConfig, seed: number): GameState {
  const dungeon = generateDungeon(seed)
  return {
    ...config,
    dungeon,
    player: { ...dungeon.playerStart },
    hp: config.maxHp,
    enemies: dungeon.enemies.map((e) => ({ ...e })),
    status: 'idle',
    kills: 0,
    turns: 0,
    // The hero can already see the room they start in.
    revealedRooms: reveal([], roomAt(dungeon.rooms, dungeon.playerStart.x, dungeon.playerStart.y)),
    log: [],
    nextLogId: 0,
    rngState: seed >>> 0,
    aiming: false,
    targetId: null,
  }
}

/** Pull the hero's profile back out of a live game state. */
function configOf(state: GameState): HeroConfig {
  return { maxHp: state.maxHp, attacks: state.attacks }
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

function tileAt(dungeon: Dungeon, x: number, y: number): TileType {
  if (y < 0 || y >= dungeon.rows || x < 0 || x >= dungeon.cols) return 'wall'
  return dungeon.tiles[y][x]
}

/** Choose a foe's next tile: one orthogonal step toward the hero, staying inside
 *  its room and off any occupied tile. Returns the foe's current tile if boxed in. */
function chaseStep(rooms: Room[], foe: Enemy, target: Point, occupied: Set<string>): Point {
  const room = rooms[foe.room]
  const dx = target.x - foe.x
  const dy = target.y - foe.y
  const horiz: Point | null = dx !== 0 ? { x: foe.x + Math.sign(dx), y: foe.y } : null
  const vert: Point | null = dy !== 0 ? { x: foe.x, y: foe.y + Math.sign(dy) } : null
  // Try to close the larger gap first; fall back to the other axis if blocked.
  const candidates = Math.abs(dx) >= Math.abs(dy) ? [horiz, vert] : [vert, horiz]

  for (const c of candidates) {
    if (!c) continue
    const inRoom = c.x >= room.x0 && c.x <= room.x1 && c.y >= room.y0 && c.y <= room.y1
    if (inRoom && !occupied.has(`${c.x},${c.y}`)) return c
  }
  return { x: foe.x, y: foe.y }
}

const manhattan = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

/** Enemies sharing the hero's current room, in stable id order. */
function activeEnemiesOf(rooms: Room[], player: Point, enemies: Enemy[]): Enemy[] {
  const room = roomAt(rooms, player.x, player.y)
  return enemies.filter((e) => e.room === room).sort((a, b) => a.id - b.id)
}

/**
 * Run the enemy phase: every foe sharing the hero's room either attacks (if
 * adjacent, rolling its own accuracy for its own damage) or chases one step.
 * Mutates `messages` and draws from the shared `roll`; returns the foes' new
 * positions and the hero's remaining hp. Used by both moving and firing so a
 * turn always ends the same way.
 */
function runEnemyPhase(
  dungeon: Dungeon,
  player: Point,
  enemies: Enemy[],
  hp: number,
  roll: () => number,
  messages: string[],
): { enemies: Enemy[]; hp: number } {
  const room = roomAt(dungeon.rooms, player.x, player.y)
  const occupied = new Set(enemies.map((e) => `${e.x},${e.y}`))
  const moved: Enemy[] = []
  let nextHp = hp

  for (const foe of enemies) {
    if (foe.room !== room) {
      moved.push(foe)
      continue
    }
    if (manhattan(foe, player) === 1) {
      // Adjacent: the foe rolls to land its attack for its flat damage.
      const info = ENEMY_INFO[foe.kind]
      if (roll() < info.accuracy) {
        nextHp -= info.damage
        messages.push(`The ${info.name} ${info.verb} you for ${info.damage}.`)
      } else {
        messages.push(`The ${info.name} misses you.`)
      }
      moved.push(foe)
      continue
    }
    // Otherwise chase. Reserve the destination so two foes can't stack.
    occupied.delete(`${foe.x},${foe.y}`)
    const step = chaseStep(dungeon.rooms, foe, player, occupied)
    occupied.add(`${step.x},${step.y}`)
    moved.push({ ...foe, x: step.x, y: step.y })
  }

  return { enemies: moved, hp: nextHp }
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'configure':
      return makeInitial(action.config, action.seed)
    case 'reset':
      return makeInitial(configOf(state), action.seed)
    case 'start': {
      const fresh = makeInitial(configOf(state), action.seed)
      const room = roomAt(fresh.dungeon.rooms, fresh.player.x, fresh.player.y)
      const opening = [
        'You descend into the dungeon of Noragon.',
        room !== null ? `You enter ${fresh.dungeon.rooms[room].name}.` : 'You press into the dark.',
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
        // Bump-to-attack resolves the hero's melee profile: to-hit, then damage.
        const name = ENEMY_INFO[targetBat.kind].name
        const { hit, damage } = resolveAttack(state.attacks.melee, roll)
        if (hit) {
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
      } else if (tileAt(state.dungeon, target.x, target.y) === 'wall') {
        // Bumping a wall is not a turn — nothing happens, and nothing is logged.
        return state
      } else {
        player = target
        messages.push(`You move ${DIR_NAME[action.dir]}.`)
        // Stepping onto the chest completes the level before enemies act.
        if (tileAt(state.dungeon, target.x, target.y) === 'chest') {
          messages.push('You reach the chest. The level is cleared!')
          return {
            ...state,
            player,
            status: 'won',
            turns: state.turns + 1,
            revealedRooms: reveal(
              state.revealedRooms,
              roomAt(state.dungeon.rooms, player.x, player.y),
            ),
            ...logLines(state.log, state.nextLogId, messages),
          }
        }
        // Announce crossing into a room the hero hasn't been in before.
        const steppedInto = roomAt(state.dungeon.rooms, player.x, player.y)
        if (steppedInto !== null && !state.revealedRooms.includes(steppedInto)) {
          messages.push(`You enter ${state.dungeon.rooms[steppedInto].name}.`)
        }
      }

      // Light up the room the hero just stepped into (a no-op if already known).
      const revealedRooms = reveal(
        state.revealedRooms,
        roomAt(state.dungeon.rooms, player.x, player.y),
      )

      const phase = runEnemyPhase(state.dungeon, player, enemies, state.hp, roll, messages)
      const status: GameStatus = phase.hp <= 0 ? 'dead' : 'playing'
      if (status === 'dead') messages.push('You collapse, slain in the dark.')

      return {
        ...state,
        player,
        hp: Math.max(0, phase.hp),
        enemies: phase.enemies,
        kills,
        status,
        turns: state.turns + 1,
        revealedRooms,
        rngState,
        // Stepping ends any aim that was somehow still open.
        aiming: false,
        targetId: null,
        ...logLines(state.log, state.nextLogId, messages),
      }
    }
    case 'aimStart': {
      if (state.status !== 'playing') return state
      const actives = activeEnemiesOf(state.dungeon.rooms, state.player, state.enemies)
      if (actives.length === 0) {
        return {
          ...state,
          ...logLines(state.log, state.nextLogId, ['There is nothing in range to shoot.']),
        }
      }
      // Auto-select the nearest enemy as the starting target.
      let nearest = actives[0]
      for (const e of actives) {
        if (manhattan(e, state.player) < manhattan(nearest, state.player)) nearest = e
      }
      return { ...state, aiming: true, targetId: nearest.id }
    }
    case 'aimCycle': {
      if (!state.aiming) return state
      const actives = activeEnemiesOf(state.dungeon.rooms, state.player, state.enemies)
      if (actives.length === 0) return { ...state, aiming: false, targetId: null }
      const current = actives.findIndex((e) => e.id === state.targetId)
      const base = current === -1 ? 0 : current
      const next = (base + action.delta + actives.length) % actives.length
      return { ...state, targetId: actives[next].id }
    }
    case 'aimCancel':
      if (!state.aiming) return state
      return { ...state, aiming: false, targetId: null }
    case 'fire': {
      if (state.status !== 'playing' || !state.aiming) return state
      const target = state.enemies.find((e) => e.id === state.targetId)
      const room = roomAt(state.dungeon.rooms, state.player.x, state.player.y)
      // Target must still be a live enemy in the hero's room.
      if (!target || target.room !== room) {
        return { ...state, aiming: false, targetId: null }
      }

      let rngState = state.rngState
      const roll = () => {
        const r = nextRng(rngState)
        rngState = r.state
        return r.value
      }
      const messages: string[] = []
      let enemies = state.enemies
      let kills = state.kills

      // The hero looses an arrow: resolve the ranged profile, then enemies act.
      const name = ENEMY_INFO[target.kind].name
      const { hit, damage } = resolveAttack(state.attacks.ranged, roll)
      if (hit) {
        enemies = state.enemies
          .map((e) => (e.id === target.id ? { ...e, hp: e.hp - damage } : e))
          .filter((e) => e.hp > 0)
        const slain = enemies.length < state.enemies.length
        kills = state.kills + (slain ? 1 : 0)
        messages.push(
          slain
            ? `You shoot the ${name} for ${damage} — slain!`
            : `You shoot the ${name} for ${damage}.`,
        )
      } else {
        messages.push(`Your arrow misses the ${name}.`)
      }

      const phase = runEnemyPhase(state.dungeon, state.player, enemies, state.hp, roll, messages)
      const status: GameStatus = phase.hp <= 0 ? 'dead' : 'playing'
      if (status === 'dead') messages.push('You collapse, slain in the dark.')

      return {
        ...state,
        hp: Math.max(0, phase.hp),
        enemies: phase.enemies,
        kills,
        status,
        turns: state.turns + 1,
        aiming: false,
        targetId: null,
        rngState,
        ...logLines(state.log, state.nextLogId, messages),
      }
    }
  }
}

export function useNoragon(options: UseNoragonOptions = {}): NoragonApi {
  const maxHp = options.maxHp ?? DEFAULTS.maxHp
  const seed = options.seed

  // Flatten the attack overrides to primitives so the config effect depends on
  // actual values, not the identity of an inline `attacks` object (which would
  // otherwise re-fire every render and reset the game mid-play).
  const a = options.attacks
  const meleeAccuracy = a?.melee?.accuracy ?? DEFAULT_ATTACKS.melee.accuracy
  const meleeMinDamage = a?.melee?.minDamage ?? DEFAULT_ATTACKS.melee.minDamage
  const meleeMaxDamage = a?.melee?.maxDamage ?? DEFAULT_ATTACKS.melee.maxDamage
  const rangedAccuracy = a?.ranged?.accuracy ?? DEFAULT_ATTACKS.ranged.accuracy
  const rangedMinDamage = a?.ranged?.minDamage ?? DEFAULT_ATTACKS.ranged.minDamage
  const rangedMaxDamage = a?.ranged?.maxDamage ?? DEFAULT_ATTACKS.ranged.maxDamage
  const spellAccuracy = a?.spell?.accuracy ?? DEFAULT_ATTACKS.spell.accuracy
  const spellMinDamage = a?.spell?.minDamage ?? DEFAULT_ATTACKS.spell.minDamage
  const spellMaxDamage = a?.spell?.maxDamage ?? DEFAULT_ATTACKS.spell.maxDamage

  const attacks = useMemo<AttackProfiles>(
    () => ({
      melee: { accuracy: meleeAccuracy, minDamage: meleeMinDamage, maxDamage: meleeMaxDamage },
      ranged: { accuracy: rangedAccuracy, minDamage: rangedMinDamage, maxDamage: rangedMaxDamage },
      spell: { accuracy: spellAccuracy, minDamage: spellMinDamage, maxDamage: spellMaxDamage },
    }),
    [
      meleeAccuracy,
      meleeMinDamage,
      meleeMaxDamage,
      rangedAccuracy,
      rangedMinDamage,
      rangedMaxDamage,
      spellAccuracy,
      spellMinDamage,
      spellMaxDamage,
    ],
  )

  // A fixed `seed` makes every run reproducible; otherwise each (re)start draws
  // a fresh random seed. Generated outside the reducer so the reducer stays pure.
  const makeSeed = useCallback(() => seed ?? Math.floor(Math.random() * 0x7fffffff), [seed])

  const [state, dispatch] = useReducer(reducer, undefined, () =>
    makeInitial({ maxHp, attacks }, seed ?? 1),
  )

  // Re-lay the dungeon whenever the hero's profile changes.
  useEffect(() => {
    dispatch({ type: 'configure', config: { maxHp, attacks }, seed: makeSeed() })
  }, [maxHp, attacks, makeSeed])

  const start = useCallback(() => dispatch({ type: 'start', seed: makeSeed() }), [makeSeed])
  const reset = useCallback(() => dispatch({ type: 'reset', seed: makeSeed() }), [makeSeed])
  const move = useCallback((dir: Direction) => dispatch({ type: 'move', dir }), [])
  const aimStart = useCallback(() => dispatch({ type: 'aimStart' }), [])
  const aimCycle = useCallback((delta: number) => dispatch({ type: 'aimCycle', delta }), [])
  const aimCancel = useCallback(() => dispatch({ type: 'aimCancel' }), [])
  const fire = useCallback(() => dispatch({ type: 'fire' }), [])

  // Enemies are "active" only while the hero shares their room — the same rule
  // that governs whether they take turns. Those are the ones we surface as cards.
  const currentRoom = roomAt(state.dungeon.rooms, state.player.x, state.player.y)
  const activeEnemies = state.enemies.filter((e) => e.room === currentRoom)

  return {
    cols: state.dungeon.cols,
    rows: state.dungeon.rows,
    tiles: state.dungeon.tiles,
    player: state.player,
    hp: state.hp,
    maxHp: state.maxHp,
    attacks: state.attacks,
    enemies: state.enemies,
    activeEnemies,
    status: state.status,
    kills: state.kills,
    turns: state.turns,
    currentRoom,
    log: state.log,
    revealedRooms: state.revealedRooms,
    // Standing in a doorway also lights up the room ahead (view only — it isn't
    // counted as "entered" until the hero actually steps inside).
    visible: computeVisible(state.dungeon, [
      ...state.revealedRooms,
      ...roomsByDoor(state.dungeon, state.player),
    ]),
    aiming: state.aiming,
    targetId: state.targetId,
    start,
    reset,
    move,
    aimStart,
    aimCycle,
    aimCancel,
    fire,
  }
}

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
// The level is a grid of rooms joined by doorways. A seeded RNG picks the grid
// size, may omit some cells (keeping the rest connected), sizes each room, carves
// a spanning set of doors (so every room is reachable), drops the chest in the
// farthest room, and scatters enemies by depth. Rooms-on-a-grid keeps today's
// room model — fog of war, enemy confinement, and activation are all keyed on
// rooms — while making every run a different shape and size.
//
// Each room lives in a CELL×CELL slot (a MAX_ROOM interior plus one wall). Rooms
// vary from MIN_ROOM to MAX_ROOM and are anchored to the slot edge on any side
// they connect through; because any span ≥ MIN_ROOM (3) inside a 5-wide slot
// always covers the slot centre, adjacent rooms overlap and a single-tile door
// always lands floor-to-floor — no corridors required.
const CELL = 6
const MAX_ROOM = 5
const MIN_ROOM = 3
/** Never shrink an irregular footprint below this many rooms. */
const MIN_CELLS = 4

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
 * Build the dungeon for a run from `seed`: pick a grid size, optionally omit some
 * cells (keeping the rest connected), size each room, connect them with a random
 * spanning set of doors (plus a few loops), drop the chest in the farthest room,
 * and scatter enemies by depth — the start room stays safe and the vault is
 * guarded. Deterministic: the same seed always yields the same map.
 */
function generateDungeon(seed: number): Dungeon {
  // A stream distinct from the combat RNG (which is seeded directly from `seed`).
  const rng = makeRng((seed ^ 0x9e3779b9) >>> 0)

  // Variable map size: a 2–3 × 2–3 grid of room slots.
  const gridCols = 2 + rng.int(2)
  const gridRows = 2 + rng.int(2)
  const cellCount = gridCols * gridRows
  const cols = gridCols * CELL + 1
  const rows = gridRows * CELL + 1

  const gxOf = (cell: number) => cell % gridCols
  const gyOf = (cell: number) => Math.floor(cell / gridCols)
  const slotOf = (cell: number) => {
    const x0 = gxOf(cell) * CELL + 1
    const y0 = gyOf(cell) * CELL + 1
    return { x0, y0, x1: x0 + MAX_ROOM - 1, y1: y0 + MAX_ROOM - 1 }
  }
  const gridNeighbors = (cell: number): number[] => {
    const x = gxOf(cell)
    const y = gyOf(cell)
    const out: number[] = []
    if (x > 0) out.push(cell - 1)
    if (x < gridCols - 1) out.push(cell + 1)
    if (y > 0) out.push(cell - gridCols)
    if (y < gridRows - 1) out.push(cell + gridCols)
    return out
  }

  // Irregular footprint: drop cells at random while the rest stay connected.
  const connected = (set: Set<number>): boolean => {
    if (set.size === 0) return false
    const first = set.values().next().value ?? 0
    const seen = new Set<number>([first])
    const stack = [first]
    while (stack.length) {
      const c = stack.pop() ?? 0
      for (const n of gridNeighbors(c)) {
        if (set.has(n) && !seen.has(n)) {
          seen.add(n)
          stack.push(n)
        }
      }
    }
    return seen.size === set.size
  }
  const present = new Set<number>()
  for (let i = 0; i < cellCount; i++) present.add(i)
  const order: number[] = []
  for (let i = 0; i < cellCount; i++) order.push(i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }
  for (const cell of order) {
    if (present.size <= MIN_CELLS) break
    if (rng.next() >= 0.35) continue
    const trial = new Set(present)
    trial.delete(cell)
    if (connected(trial)) present.delete(cell)
  }
  const cells = [...present].sort((a, b) => a - b)
  const neighbors = (cell: number) => gridNeighbors(cell).filter((n) => present.has(n))

  // Connect the present cells: spanning tree (randomized DFS) plus a few loops.
  const links = new Map<number, Set<number>>()
  for (const c of cells) links.set(c, new Set<number>())
  const linkUp = (a: number, b: number) => {
    links.get(a)?.add(b)
    links.get(b)?.add(a)
  }
  const startCell = cells[rng.int(cells.length)]
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
    linkUp(cur, next)
    visited.add(next)
    stack.push(next)
  }
  for (const c of cells) {
    for (const n of neighbors(c)) {
      if (n > c && !links.get(c)?.has(n) && rng.next() < 0.25) linkUp(c, n)
    }
  }

  // BFS distances from the start cell over the carved links.
  const dist = new Map<number, number>([[startCell, 0]])
  const queue = [startCell]
  for (let i = 0; i < queue.length; i++) {
    for (const n of links.get(queue[i]) ?? []) {
      if (!dist.has(n)) {
        dist.set(n, (dist.get(queue[i]) ?? 0) + 1)
        queue.push(n)
      }
    }
  }
  let chestCell = startCell
  for (const c of cells) {
    if ((dist.get(c) ?? 0) > (dist.get(chestCell) ?? 0)) chestCell = c
  }

  // Size and record each room. A room is anchored to the slot edge on any side it
  // connects through (so its single-tile door lands on floor); free sides shrink.
  const span = (lo: number, lowConn: boolean, highConn: boolean): [number, number] => {
    const hi = lo + MAX_ROOM - 1
    if (lowConn && highConn) return [lo, hi]
    const size = MIN_ROOM + rng.int(MAX_ROOM - MIN_ROOM + 1)
    if (lowConn) return [lo, lo + size - 1]
    if (highConn) return [hi - size + 1, hi]
    const off = rng.int(MAX_ROOM - size + 1)
    return [lo + off, lo + off + size - 1]
  }
  const rooms: Room[] = []
  const cellToRoom = new Map<number, number>()
  let nameIdx = 0
  for (const cell of cells) {
    const s = slotOf(cell)
    const linked = links.get(cell) ?? new Set<number>()
    let w = false
    let e = false
    let n = false
    let sth = false
    for (const other of linked) {
      if (other === cell - 1) w = true
      else if (other === cell + 1) e = true
      else if (other === cell - gridCols) n = true
      else if (other === cell + gridCols) sth = true
    }
    const [x0, x1] = span(s.x0, w, e)
    const [y0, y1] = span(s.y0, n, sth)
    const name =
      cell === startCell
        ? 'the entry hall'
        : cell === chestCell
          ? 'the vault'
          : ROOM_NAMES[nameIdx++ % ROOM_NAMES.length]
    cellToRoom.set(cell, rooms.length)
    rooms.push({ id: rooms.length, name, x0, y0, x1, y1 })
  }

  // Start every tile as wall, then carve room interiors.
  const tiles: TileType[][] = []
  for (let y = 0; y < rows; y++) {
    const row: TileType[] = []
    for (let x = 0; x < cols; x++) row.push('wall')
    tiles.push(row)
  }
  for (const room of rooms) {
    for (let y = room.y0; y <= room.y1; y++) {
      for (let x = room.x0; x <= room.x1; x++) tiles[y][x] = 'floor'
    }
  }

  // Carve a door for each link, on the shared wall within the rooms' overlap.
  const roomOf = (cell: number) => rooms[cellToRoom.get(cell) ?? 0]
  for (const c of cells) {
    for (const other of links.get(c) ?? []) {
      if (other <= c) continue
      const ra = roomOf(c)
      const rb = roomOf(other)
      if (gyOf(c) === gyOf(other)) {
        const col = Math.min(ra.x1, rb.x1) + 1
        const lo = Math.max(ra.y0, rb.y0)
        const hi = Math.min(ra.y1, rb.y1)
        tiles[lo + rng.int(hi - lo + 1)][col] = 'door'
      } else {
        const row = Math.min(ra.y1, rb.y1) + 1
        const lo = Math.max(ra.x0, rb.x0)
        const hi = Math.min(ra.x1, rb.x1)
        tiles[row][lo + rng.int(hi - lo + 1)] = 'door'
      }
    }
  }

  const center = (room: Room): Point => ({
    x: Math.floor((room.x0 + room.x1) / 2),
    y: Math.floor((room.y0 + room.y1) / 2),
  })
  const playerStart = center(roomOf(startCell))

  // Place the chest (the win tile) and an inert stairway beside it.
  const chestRoom = roomOf(chestCell)
  const chestAt = center(chestRoom)
  tiles[chestAt.y][chestAt.x] = 'chest'
  if (chestAt.x + 1 <= chestRoom.x1) tiles[chestAt.y][chestAt.x + 1] = 'stairs'

  // Scatter enemies by depth onto free interior floor tiles.
  const taken = new Set<string>([`${playerStart.x},${playerStart.y}`])
  const enemies: Enemy[] = []
  let enemyId = 0
  const placeIn = (room: Room, kinds: EnemyKind[]) => {
    const free: Point[] = []
    for (let y = room.y0; y <= room.y1; y++) {
      for (let x = room.x0; x <= room.x1; x++) {
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
  for (const cell of cells) {
    if (cell === startCell) continue
    if (cell === chestCell) {
      placeIn(roomOf(cell), ['goblin', 'bat']) // guarded loot
      continue
    }
    const d = dist.get(cell) ?? 1
    const kinds: EnemyKind[] = d >= 3 ? ['bat', 'goblin'] : d === 2 ? ['bat', 'bat'] : ['bat']
    placeIn(roomOf(cell), kinds)
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

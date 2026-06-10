import { render, renderHook, act, fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Noragon } from './Noragon'
import { Inventory } from './Inventory'
import { ActivityLog } from './ActivityLog'
import { Board } from './Board'
import { useNoragon } from './../game/useNoragon'
import { ENEMY_INFO, enemyStatsAt } from '../game/enemies'
import { ITEMS } from '../game/items'
import { buyPrice, sellPrice } from '../game/utils'
import { Shop } from './Shop'
import type {
  Direction,
  FloorItem,
  NoragonApi,
  Point,
  TileType,
  UseNoragonOptions,
} from '../game/types'

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const KEY: Record<Direction, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
}

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']

const keyOf = (p: Point) => `${p.x},${p.y}`

function findTile(tiles: TileType[][], type: TileType): Point | null {
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      if (tiles[y][x] === type) return { x, y }
    }
  }
  return null
}

/** BFS over walkable tiles; returns the first step from `from` toward `to`. */
function bfsDir(tiles: TileType[][], from: Point, to: Point, blockChest = false): Direction | null {
  const walkable = (x: number, y: number) => {
    const t = tiles[y]?.[x]
    if (!t || t === 'wall' || t === 'rubble' || t === 'merchant') return false
    if (blockChest && t === 'chest') return false
    return true
  }
  const prev = new Map<string, { from: Point; dir: Direction } | null>()
  prev.set(keyOf(from), null)
  const queue: Point[] = [from]
  while (queue.length) {
    const cur = queue.shift()
    if (!cur) break
    if (cur.x === to.x && cur.y === to.y) break
    for (const dir of DIRECTIONS) {
      const nx = cur.x + DELTA[dir].x
      const ny = cur.y + DELTA[dir].y
      if (!walkable(nx, ny)) continue
      const k = `${nx},${ny}`
      if (prev.has(k)) continue
      prev.set(k, { from: cur, dir })
      queue.push({ x: nx, y: ny })
    }
  }
  if (!prev.has(keyOf(to))) return null
  let entry = prev.get(keyOf(to))
  if (!entry) return null
  while (entry && !(entry.from.x === from.x && entry.from.y === from.y)) {
    entry = prev.get(keyOf(entry.from))
  }
  return entry ? entry.dir : null
}

type Hook = { current: NoragonApi }

/** Walk the hero to a target tile, re-pathing each step (enemies get bumped). */
function navigateToTile(result: Hook, target: Point, blockChest = true, cap = 600) {
  for (let i = 0; i < cap && result.current.run.status === 'playing'; i++) {
    const p = result.current.hero.position
    if (p.x === target.x && p.y === target.y) break
    const dir = bfsDir(result.current.board.tiles, p, target, blockChest)
    if (!dir) break
    act(() => result.current.move(dir))
  }
}

/** Walk to the merchant and bump it to open the shop. Returns whether it opened. */
function openShop(result: Hook): boolean {
  const tiles = result.current.board.tiles
  let merchant: Point | null = null
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) if (tiles[y][x] === 'merchant') merchant = { x, y }
  }
  if (!merchant) return false
  // Stand on a floor tile beside the merchant, then bump into it.
  let stand: Point | null = null
  for (const dir of DIRECTIONS) {
    const a = { x: merchant.x + DELTA[dir].x, y: merchant.y + DELTA[dir].y }
    if (tiles[a.y]?.[a.x] === 'floor') {
      stand = a
      break
    }
  }
  if (!stand) return false
  navigateToTile(result, stand)
  const p = result.current.hero.position
  if (p.x !== stand.x || p.y !== stand.y) return false
  const bump = DIRECTIONS.find(
    (d) => DELTA[d].x === merchant.x - stand.x && DELTA[d].y === merchant.y - stand.y,
  )
  if (!bump) return false
  act(() => result.current.move(bump))
  return result.current.shopping
}

/** Walk toward `enemies[0]` until the hero shares a room with active enemies. */
function enterEnemyRoom(result: Hook, cap = 600) {
  for (let i = 0; i < cap && result.current.run.status === 'playing'; i++) {
    if (result.current.activeEnemies.length > 0) return
    const foe = result.current.enemies[0]
    if (!foe) return
    const dir = bfsDir(
      result.current.board.tiles,
      result.current.hero.position,
      { x: foe.x, y: foe.y },
      true,
    )
    if (!dir) return
    act(() => result.current.move(dir))
  }
}

/** Walk into a room that holds at least two enemies (for target cycling). */
function enterMultiEnemyRoom(result: Hook, cap = 600) {
  const counts = new Map<number, number>()
  for (const e of result.current.enemies) counts.set(e.room, (counts.get(e.room) ?? 0) + 1)
  let roomId = -1
  for (const [room, n] of counts) {
    if (n >= 2) {
      roomId = room
      break
    }
  }
  if (roomId === -1) return
  for (let i = 0; i < cap && result.current.run.status === 'playing'; i++) {
    if (result.current.activeEnemies.length >= 2) return
    const foe = result.current.enemies.find((e) => e.room === roomId)
    if (!foe) return
    const dir = bfsDir(
      result.current.board.tiles,
      result.current.hero.position,
      { x: foe.x, y: foe.y },
      true,
    )
    if (!dir) return
    act(() => result.current.move(dir))
  }
}

/** Hunt down and kill every enemy on the level (never stepping on the chest). */
function clearDungeon(result: Hook, cap = 3000) {
  for (
    let i = 0;
    i < cap && result.current.enemies.length > 0 && result.current.run.status === 'playing';
    i++
  ) {
    const foe = result.current.enemies[0]
    if (!foe) break
    const dir = bfsDir(
      result.current.board.tiles,
      result.current.hero.position,
      { x: foe.x, y: foe.y },
      true,
    )
    if (!dir) break
    act(() => result.current.move(dir))
  }
}

/** Walk onto the stairs and take them down one level. */
function takeStairs(result: Hook) {
  const stairs = findTile(result.current.board.tiles, 'stairs')
  if (!stairs) return
  navigateToTile(result, stairs, false)
  if (result.current.hero.onStairs) act(() => result.current.descend())
}

/** Clear each level and take the stairs until the run reaches `target` depth. */
function descendToDepth(result: Hook, target: number, cap = 25) {
  for (
    let d = 0;
    d < cap && result.current.run.depth < target && result.current.run.status === 'playing';
    d++
  ) {
    clearDungeon(result)
    const before = result.current.run.depth
    takeStairs(result)
    if (result.current.run.depth === before) break
  }
}

/** Compute the keystroke path to the first enemy room for a given run. */
function dirsToEnemyRoom(opts: UseNoragonOptions): Direction[] {
  const { result, unmount } = renderHook(() => useNoragon(opts))
  act(() => result.current.start())
  const dirs: Direction[] = []
  for (let i = 0; i < 200 && result.current.run.status === 'playing'; i++) {
    if (result.current.activeEnemies.length > 0) break
    const foe = result.current.enemies[0]
    if (!foe) break
    const dir = bfsDir(
      result.current.board.tiles,
      result.current.hero.position,
      { x: foe.x, y: foe.y },
      true,
    )
    if (!dir) break
    dirs.push(dir)
    act(() => result.current.move(dir))
  }
  unmount()
  return dirs
}

const SEEDS = [1, 7, 42, 99, 256, 4242]

describe('<Noragon />', () => {
  it('renders the title, the hero stats, and the idle overlay by default', () => {
    render(<Noragon />)
    expect(screen.getByRole('heading', { name: 'Legends of Noragon' })).toBeInTheDocument()
    expect(screen.getByText('12/12')).toBeInTheDocument() // HP
    expect(screen.getByText('85%')).toBeInTheDocument() // melee accuracy (incl. Short Sword)
    expect(screen.getByText('5–8')).toBeInTheDocument() // damage (3–6 base + 2 from the sword)
    expect(screen.getByText('Descend into the dungeon of Noragon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter' })).toBeInTheDocument()
  })

  it('hides the title when title is null', () => {
    render(<Noragon title={null} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('starts on the first direction key and renders the hero', () => {
    render(<Noragon seed={7} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.queryByText('Descend into the dungeon of Noragon')).not.toBeInTheDocument()
    expect(screen.getByTestId('player')).toBeInTheDocument()
  })

  it('starts the dungeon when Enter is pressed from the idle screen', () => {
    render(<Noragon seed={7} />)
    expect(screen.getByText('Descend into the dungeon of Noragon')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByText('Descend into the dungeon of Noragon')).not.toBeInTheDocument()
    expect(screen.getByTestId('player')).toBeInTheDocument()
  })

  it('records each turn in the activity log', () => {
    render(<Noragon seed={7} />)
    // The hero starts at a room centre, so a step east is always onto floor.
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    const log = screen.getByTestId('activity-log')
    expect(log).toHaveTextContent('You descend into the dungeon of Noragon.')
    expect(log).toHaveTextContent('You move east.')
  })

  it('keeps enemies hidden until the hero enters their room', () => {
    const opts = {
      seed: 7,
      maxHp: 99,
      attacks: { melee: { accuracy: 0, minDamage: 3, maxDamage: 6 } },
    }
    const dirs = dirsToEnemyRoom(opts)
    render(<Noragon {...opts} />)
    // Nothing dangerous is on screen from the safe entry hall.
    expect(screen.queryAllByTestId(/^enemy-/)).toHaveLength(0)
    for (const dir of dirs) fireEvent.keyDown(window, { key: KEY[dir] })
    expect(screen.getAllByTestId(/^enemy-/).length).toBeGreaterThan(0)
  })

  it('aims with F (banner + targeted card) and fires with F', () => {
    const opts = {
      seed: 7,
      maxHp: 99,
      attacks: {
        melee: { accuracy: 0, minDamage: 3, maxDamage: 6 },
        ranged: { accuracy: 1, minDamage: 10, maxDamage: 10 },
      },
    }
    const dirs = dirsToEnemyRoom(opts)
    render(<Noragon {...opts} />)
    for (const dir of dirs) fireEvent.keyDown(window, { key: KEY[dir] })

    expect(screen.queryByTestId('aim-banner')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'f' })
    expect(screen.getByTestId('aim-banner')).toBeInTheDocument()
    expect(
      screen.getAllByTestId('enemy-card').filter((c) => c.getAttribute('aria-current')),
    ).toHaveLength(1)

    fireEvent.keyDown(window, { key: 'Enter' }) // loose the arrow
    expect(screen.queryByTestId('aim-banner')).not.toBeInTheDocument()
    expect(screen.getByTestId('activity-log')).toHaveTextContent('You shoot the')
  })

  it('toggles aiming off with F without firing (no turn spent)', () => {
    const opts = {
      seed: 7,
      maxHp: 99,
      attacks: { melee: { accuracy: 0, minDamage: 3, maxDamage: 6 } },
    }
    const dirs = dirsToEnemyRoom(opts)
    render(<Noragon {...opts} />)
    for (const dir of dirs) fireEvent.keyDown(window, { key: KEY[dir] })

    fireEvent.keyDown(window, { key: 'f' })
    expect(screen.getByTestId('aim-banner')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'f' }) // F again toggles aiming off — no shot
    expect(screen.queryByTestId('aim-banner')).not.toBeInTheDocument()
    expect(screen.getByTestId('activity-log')).not.toHaveTextContent('You shoot')
  })

  it('cancels aiming with Escape without firing', () => {
    const opts = {
      seed: 7,
      maxHp: 99,
      attacks: { melee: { accuracy: 0, minDamage: 3, maxDamage: 6 } },
    }
    const dirs = dirsToEnemyRoom(opts)
    render(<Noragon {...opts} />)
    for (const dir of dirs) fireEvent.keyDown(window, { key: KEY[dir] })

    fireEvent.keyDown(window, { key: 'f' })
    expect(screen.getByTestId('aim-banner')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('aim-banner')).not.toBeInTheDocument()
    expect(screen.getByTestId('activity-log')).not.toHaveTextContent('You shoot')
  })
})

describe('useNoragon — procedural generation', () => {
  const layoutOf = (result: Hook) => ({
    tiles: result.current.board.tiles.map((row) => row.join('')),
    player: result.current.hero.position,
    enemies: result.current.enemies.map((e) => ({ kind: e.kind, x: e.x, y: e.y })),
  })

  it('generates the same dungeon for the same seed', () => {
    const run = () => {
      const { result } = renderHook(() => useNoragon({ seed: 123 }))
      act(() => result.current.start())
      return layoutOf(result)
    }
    expect(run()).toEqual(run())
  })

  it('generates different dungeons for different seeds', () => {
    const fingerprint = (seed: number) => {
      const { result } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      return result.current.board.tiles.map((row) => row.join('')).join('\n')
    }
    const unique = new Set(SEEDS.map(fingerprint))
    expect(unique.size).toBeGreaterThan(1)
  })

  it('is always walled, holds exactly one chest, and is fully solvable', () => {
    for (const seed of SEEDS) {
      const { result } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      const { tiles } = result.current.board
      const player = result.current.hero.position
      const rows = tiles.length
      const cols = tiles[0].length

      // Solid outer border.
      for (let x = 0; x < cols; x++) {
        expect(tiles[0][x]).toBe('wall')
        expect(tiles[rows - 1][x]).toBe('wall')
      }
      for (let y = 0; y < rows; y++) {
        expect(tiles[y][0]).toBe('wall')
        expect(tiles[y][cols - 1]).toBe('wall')
      }

      // Exactly one chest, and the hero stands on floor.
      const chestCount = tiles.flat().filter((t) => t === 'chest').length
      expect(chestCount).toBe(1)
      expect(tiles[player.y][player.x]).toBe('floor')

      // The chest is reachable from the hero across walkable tiles.
      const chest = findTile(tiles, 'chest')
      expect(chest).not.toBeNull()
      const seen = new Set<string>([keyOf(player)])
      const queue: Point[] = [player]
      while (queue.length) {
        const c = queue.shift()
        if (!c) break
        for (const dir of DIRECTIONS) {
          const nx = c.x + DELTA[dir].x
          const ny = c.y + DELTA[dir].y
          const t = tiles[ny]?.[nx]
          if (!t || t === 'wall' || seen.has(`${nx},${ny}`)) continue
          seen.add(`${nx},${ny}`)
          queue.push({ x: nx, y: ny })
        }
      }
      if (chest) expect(seen.has(keyOf(chest))).toBe(true)
    }
  })

  it('carves corridors connecting the rooms', () => {
    for (const seed of SEEDS) {
      const { result } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      const corridors = result.current.board.tiles.flat().filter((t) => t === 'corridor').length
      expect(corridors).toBeGreaterThan(0)
    }
  })

  it('joins corridors to rooms only through doors (no double entryways)', () => {
    for (const seed of SEEDS) {
      const { result } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      const tiles = result.current.board.tiles
      // A corridor tile must never sit directly against room floor — the only
      // bridge between a corridor and a room is a single `door` tile.
      for (let y = 0; y < tiles.length; y++) {
        for (let x = 0; x < tiles[y].length; x++) {
          if (tiles[y][x] !== 'corridor') continue
          for (const dir of DIRECTIONS) {
            expect(tiles[y + DELTA[dir].y]?.[x + DELTA[dir].x]).not.toBe('floor')
          }
        }
      }
    }
  })

  it('lights corridors with the torch trail as the hero explores', () => {
    const { result } = renderHook(() => useNoragon({ maxHp: 99, seed: 7 }))
    act(() => result.current.start())
    const chest = findTile(result.current.board.tiles, 'chest')
    expect(chest).not.toBeNull()
    if (chest) navigateToTile(result, chest, false)

    // Having walked the passages to the vault, some corridor tiles are now lit
    // (no room reveals a corridor — only the torch trail does).
    const { tiles, visible } = result.current.board
    let litCorridors = 0
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        if (tiles[y][x] === 'corridor' && visible[y][x]) litCorridors++
      }
    }
    expect(litCorridors).toBeGreaterThan(0)
  })

  it('reveals the room ahead while the hero stands in a doorway', () => {
    const { result } = renderHook(() => useNoragon({ maxHp: 99, seed: 7 }))
    act(() => result.current.start())
    const chest = findTile(result.current.board.tiles, 'chest')
    expect(chest).not.toBeNull()

    // Step toward the chest until the hero is standing on a door tile.
    let onDoor = false
    for (let i = 0; i < 200 && result.current.run.status === 'playing'; i++) {
      const p = result.current.hero.position
      if (result.current.board.tiles[p.y][p.x] === 'door') {
        onDoor = true
        break
      }
      if (!chest) break
      const dir = bfsDir(result.current.board.tiles, p, chest, false)
      if (!dir) break
      act(() => result.current.move(dir))
    }
    expect(onDoor).toBe(true)

    // The floor tiles on both sides of the doorway (both rooms) are now lit —
    // including the room the hero hasn't entered yet.
    const { tiles, visible } = result.current.board
    const player = result.current.hero.position
    let floorNeighbors = 0
    for (const dir of DIRECTIONS) {
      const nx = player.x + DELTA[dir].x
      const ny = player.y + DELTA[dir].y
      if (tiles[ny]?.[nx] === 'floor') {
        floorNeighbors++
        expect(visible[ny][nx]).toBe(true)
      }
    }
    expect(floorNeighbors).toBeGreaterThan(0)
  })

  it('keeps the starting room safe (no enemies share it)', () => {
    for (const seed of SEEDS) {
      const { result } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      expect(result.current.activeEnemies).toHaveLength(0)
      expect(result.current.enemies.length).toBeGreaterThan(0) // but the dungeon has foes
    }
  })

  it('opening a chest yields gold and a potion, and consumes it', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 20, maxDamage: 20 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    clearDungeon(result) // also clears the vault guardians

    const goldBefore = result.current.hero.gold
    const potionsBefore = result.current.hero.inventory.filter(
      (i) => i.kind === 'healthPotion',
    ).length
    const chest = findTile(result.current.board.tiles, 'chest')
    expect(chest).not.toBeNull()
    if (chest) navigateToTile(result, chest, false) // step onto the chest

    expect(findTile(result.current.board.tiles, 'chest')).toBeNull() // consumed
    expect(result.current.hero.gold).toBeGreaterThan(goldBefore) // gold gained
    expect(
      result.current.hero.inventory.filter((i) => i.kind === 'healthPotion').length,
    ).toBeGreaterThan(potionsBefore) // and a potion
    expect(result.current.run.status).toBe('playing') // chests no longer end the run
  })
})

describe('useNoragon — combat', () => {
  it('can miss in melee, leaving foes unharmed', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 0, minDamage: 3, maxDamage: 6 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    enterEnemyRoom(result)
    expect(result.current.activeEnemies.length).toBeGreaterThan(0)

    // Bump the nearest foe a few times; with accuracy 0 every swing whiffs.
    for (let i = 0; i < 20; i++) {
      const foe = result.current.activeEnemies[0]
      if (!foe) break
      const dir = bfsDir(
        result.current.board.tiles,
        result.current.hero.position,
        { x: foe.x, y: foe.y },
        true,
      )
      if (!dir) break
      act(() => result.current.move(dir))
    }

    expect(result.current.log.some((e) => /and miss\.$/.test(e.text))).toBe(true)
    expect(result.current.enemies.every((e) => e.hp === e.maxHp)).toBe(true)
  })

  it('keeps melee damage within the hero’s effective range (incl. weapon)', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 3, maxDamage: 6 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    enterEnemyRoom(result)
    // Effective range = base (3–6) + the equipped Short Sword (+2) = 5–8.
    const lo = result.current.hero.attacks.melee.minDamage
    const hi = result.current.hero.attacks.melee.maxDamage

    // Bump foes while still level 1, so the effective range can't shift on us.
    for (
      let i = 0;
      i < 40 && result.current.hero.level === 1 && result.current.activeEnemies.length > 0;
      i++
    ) {
      const foe = result.current.activeEnemies[0]
      if (!foe) break
      const dir = bfsDir(
        result.current.board.tiles,
        result.current.hero.position,
        { x: foe.x, y: foe.y },
        true,
      )
      if (!dir) break
      act(() => result.current.move(dir))
    }

    const damages: number[] = []
    for (const entry of result.current.log) {
      const m = entry.text.match(/^You strike the \w+ for (\d+)/)
      if (m) damages.push(Number(m[1]))
    }
    expect(damages.length).toBeGreaterThan(0)
    expect(damages.every((d) => d >= lo && d <= hi)).toBe(true)
  })

  it('floats a damage number over a struck foe', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 4, maxDamage: 4 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    enterEnemyRoom(result)

    for (let i = 0; i < 40 && result.current.activeEnemies.length > 0; i++) {
      const foe = result.current.activeEnemies[0]
      if (!foe) break
      const dir = bfsDir(result.current.board.tiles, result.current.hero.position, foe, true)
      if (!dir) break
      const p = result.current.hero.position
      const tgt = { x: p.x + DELTA[dir].x, y: p.y + DELTA[dir].y }
      const isBump = result.current.enemies.some((e) => e.x === tgt.x && e.y === tgt.y)
      act(() => result.current.move(dir))
      if (isBump) {
        // The hero always hits (accuracy 1), so a damage float lands on the foe.
        expect(
          result.current.effects.some(
            (f) => f.tone === 'damage' && f.x === tgt.x && f.y === tgt.y && f.amount > 0,
          ),
        ).toBe(true)
        return
      }
    }
    throw new Error('never bumped a foe')
  })

  it('floats a "miss" over a foe the hero whiffs on', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        // Never connects: every swing is a miss.
        attacks: { melee: { accuracy: 0, minDamage: 4, maxDamage: 4 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    enterEnemyRoom(result)

    for (let i = 0; i < 40 && result.current.activeEnemies.length > 0; i++) {
      const foe = result.current.activeEnemies[0]
      if (!foe) break
      const dir = bfsDir(result.current.board.tiles, result.current.hero.position, foe, true)
      if (!dir) break
      const p = result.current.hero.position
      const tgt = { x: p.x + DELTA[dir].x, y: p.y + DELTA[dir].y }
      const isBump = result.current.enemies.some((e) => e.x === tgt.x && e.y === tgt.y)
      act(() => result.current.move(dir))
      if (isBump) {
        expect(
          result.current.effects.some((f) => f.tone === 'miss' && f.x === tgt.x && f.y === tgt.y),
        ).toBe(true)
        return
      }
    }
    throw new Error('never bumped a foe')
  })

  it('shoots a targeted foe from range, costing a turn', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { ranged: { accuracy: 1, minDamage: 10, maxDamage: 10 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    enterEnemyRoom(result)
    expect(result.current.activeEnemies.length).toBeGreaterThan(0)

    act(() => result.current.aimStart())
    expect(result.current.aiming).toBe(true)
    expect(result.current.targetId).not.toBeNull()
    const turnsBefore = result.current.run.turns
    const from = result.current.hero.position
    const targeted = result.current.enemies.find((e) => e.id === result.current.targetId)
    if (!targeted) throw new Error('no target')

    act(() => result.current.fire())
    expect(result.current.aiming).toBe(false)
    expect(result.current.run.turns).toBe(turnsBefore + 1)
    expect(result.current.run.kills).toBeGreaterThan(0)
    expect(result.current.log.some((e) => /^You shoot the \w+ for 10/.test(e.text))).toBe(true)

    // An arrow flies from the hero's tile to where the target stood.
    expect(result.current.projectiles).toHaveLength(1)
    expect(result.current.projectiles[0]).toMatchObject({
      kind: 'arrow',
      fromX: from.x,
      fromY: from.y,
      toX: targeted.x,
      toY: targeted.y,
    })
  })

  it('lands the arrow where the target stood when struck, not where it moves to', () => {
    // A light hit (1 dmg) so the foe is likely to survive and take its step. The
    // arrow, burst, and number stay on the tile it was struck on; the view holds
    // the foe there through the flight, then it glides on — the hit reads first.
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { ranged: { accuracy: 1, minDamage: 1, maxDamage: 1 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    enterEnemyRoom(result)

    act(() => result.current.aimStart())
    const targetId = result.current.targetId
    if (targetId == null) throw new Error('no target')
    const before = result.current.enemies.find((e) => e.id === targetId)
    if (!before) throw new Error('no target enemy')
    const struck = { x: before.x, y: before.y }

    act(() => result.current.fire())

    // The arrow and its number land on the tile the foe occupied when hit.
    expect(result.current.projectiles[0]).toMatchObject({ toX: struck.x, toY: struck.y })
    expect(
      result.current.effects.some(
        (f) => f.tone === 'damage' && f.x === struck.x && f.y === struck.y,
      ),
    ).toBe(true)
  })

  it('keeps a slain foe one turn as a fading enemy where it fell', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { ranged: { accuracy: 1, minDamage: 50, maxDamage: 50 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    enterEnemyRoom(result)

    act(() => result.current.aimStart())
    const targetId = result.current.targetId
    if (targetId == null) throw new Error('no target')
    const before = result.current.enemies.find((e) => e.id === targetId)
    if (!before) throw new Error('no target enemy')

    act(() => result.current.fire())

    // The kill removes it from the living set but keeps it fading where it fell.
    expect(result.current.enemies.some((e) => e.id === targetId)).toBe(false)
    expect(result.current.fadingEnemies).toContainEqual(
      expect.objectContaining({ id: targetId, x: before.x, y: before.y }),
    )
  })

  it('cycles the crosshairs among foes in the room', () => {
    // Sure-kill melee clears any single foe blocking the route deeper, so the
    // hero can reach a room that still holds two foes to cycle between.
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 10, maxDamage: 10 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    enterMultiEnemyRoom(result)
    expect(result.current.activeEnemies.length).toBeGreaterThanOrEqual(2)

    act(() => result.current.aimStart())
    const first = result.current.targetId
    act(() => result.current.aimCycle(1))
    const second = result.current.targetId
    act(() => result.current.aimCycle(-1))
    const third = result.current.targetId

    expect(second).not.toBe(first)
    expect(third).toBe(first)
  })

  it('kills the hero when foes land enough hits', () => {
    // 1 HP, never landing a blow (accuracy 0). The starting clothes give 1 defense,
    // so the hero must face a foe that hits for more than 1 to actually die.
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 1,
        attacks: { melee: { accuracy: 0, minDamage: 3, maxDamage: 6 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    const tough = result.current.enemies.find((e) => ENEMY_INFO[e.kind].damage > 1)
    expect(tough).toBeDefined()

    // March onto the harder-hitting foe and let it punch through the armor.
    for (let i = 0; i < 300 && result.current.run.status === 'playing'; i++) {
      const t = result.current.enemies.find((e) => e.id === tough?.id)
      if (!t) break
      const dir = bfsDir(
        result.current.board.tiles,
        result.current.hero.position,
        { x: t.x, y: t.y },
        true,
      )
      if (!dir) break
      act(() => result.current.move(dir))
    }

    expect(result.current.run.status).toBe('dead')
    expect(result.current.hero.hp).toBe(0)
  })

  it('lets foes strike a hero loitering in a doorway (no safe poking)', () => {
    // Walk toward foes (accuracy 0, so nothing dies) and, the first time the hero
    // ends a step standing on a doorway/corridor (no room) with a foe right
    // beside it, confirm that foe is active and chips the hero. The old exploit
    // let the hero poke from such a tile — which belongs to no room — for free.
    const onDoorwayBesideFoe = (r: Hook) =>
      r.current.currentRoom === null &&
      r.current.enemies.some(
        (e) =>
          Math.abs(e.x - r.current.hero.position.x) + Math.abs(e.y - r.current.hero.position.y) ===
          1,
      )

    for (const seed of [7, 1, 42, 99, 256, 4242, 5, 11, 77, 123, 2, 3]) {
      const { result, unmount } = renderHook(() =>
        useNoragon({
          maxHp: 99,
          attacks: { melee: { accuracy: 0, minDamage: 1, maxDamage: 1 } },
          seed,
        }),
      )
      act(() => result.current.start())
      // Hunt the nearest foe; stop as soon as we're in a doorway next to one.
      for (
        let i = 0;
        i < 400 && !onDoorwayBesideFoe(result) && result.current.run.status === 'playing';
        i++
      ) {
        const foe = result.current.enemies[0]
        if (!foe) break
        const dir = bfsDir(
          result.current.board.tiles,
          result.current.hero.position,
          { x: foe.x, y: foe.y },
          true,
        )
        if (!dir) break
        act(() => result.current.move(dir))
      }
      if (!onDoorwayBesideFoe(result)) {
        unmount()
        continue
      }
      expect(result.current.currentRoom).toBeNull() // on a doorway (no room)
      expect(result.current.activeEnemies.length).toBeGreaterThan(0) // yet a foe is active
      // Loiter and poke (accuracy 0 — can't kill it); it lands hits back.
      const hp0 = result.current.hero.hp
      for (let i = 0; i < 25 && result.current.hero.hp === hp0; i++) {
        const f = result.current.activeEnemies[0]
        if (!f) break
        const dir = bfsDir(
          result.current.board.tiles,
          result.current.hero.position,
          { x: f.x, y: f.y },
          false,
        )
        if (!dir) break
        act(() => result.current.move(dir))
      }
      expect(result.current.hero.hp).toBeLessThan(hp0)
      unmount()
      return
    }
    throw new Error('never reached a doorway beside a foe across candidate seeds')
  })

  it('escalates the bestiary from bats up to trolls', () => {
    const i = ENEMY_INFO
    // Goblins out-muscle bats; orcs out-muscle goblins; trolls top them all.
    expect(i.goblin.maxHp).toBeGreaterThan(i.bat.maxHp)
    expect(i.orc.maxHp).toBeGreaterThan(i.goblin.maxHp)
    expect(i.troll.maxHp).toBeGreaterThan(i.orc.maxHp)
    expect(i.troll.damage).toBeGreaterThan(i.orc.damage)
    expect(i.orc.damage).toBeGreaterThan(i.goblin.damage)
    // Tougher foes are worth more XP than the humble bat.
    for (const kind of ['spider', 'goblin', 'orc', 'troll'] as const) {
      expect(i[kind].xp).toBeGreaterThan(i.bat.xp)
    }
    expect(i.troll.xp).toBeGreaterThan(i.orc.xp)
  })

  it('ignores a move into a wall — no step, no turn', () => {
    // Sure-hit, high-damage so any foe in the way dies and the climb continues.
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 10, maxDamage: 10 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())

    // March north until a move is a true no-op (player and turn both unchanged) —
    // that is the outer wall, since enemy bumps still consume a turn.
    let bumped = false
    for (let i = 0; i < 60; i++) {
      const beforeP = result.current.hero.position
      const beforeT = result.current.run.turns
      act(() => result.current.move('up'))
      if (
        result.current.hero.position.x === beforeP.x &&
        result.current.hero.position.y === beforeP.y &&
        result.current.run.turns === beforeT
      ) {
        bumped = true
        break
      }
    }
    expect(bumped).toBe(true)
    expect(result.current.run.status).toBe('playing')
  })
})

describe('useNoragon — leveling', () => {
  it('rewards more XP for tougher foes', () => {
    expect(ENEMY_INFO.bat.xp).toBeGreaterThan(0)
    expect(ENEMY_INFO.goblin.xp).toBeGreaterThan(ENEMY_INFO.bat.xp)
  })

  it('awards XP for a kill, shown in the log', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 20, maxDamage: 20 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())

    // Hunt down and slay one foe.
    for (
      let i = 0;
      i < 60 && result.current.run.kills === 0 && result.current.run.status === 'playing';
      i++
    ) {
      const foe = result.current.enemies[0]
      if (!foe) break
      const dir = bfsDir(
        result.current.board.tiles,
        result.current.hero.position,
        { x: foe.x, y: foe.y },
        true,
      )
      if (!dir) break
      act(() => result.current.move(dir))
    }

    expect(result.current.run.kills).toBe(1)
    expect(result.current.hero.xp).toBeGreaterThan(0) // a single kill isn't enough to level
    expect(result.current.hero.level).toBe(1)
    expect(result.current.log.some((e) => /slain! \(\+\d+ XP\)$/.test(e.text))).toBe(true)
  })

  it('levels up from kills: grows max HP, damage, and accuracy, and heals', () => {
    const baseMaxHp = 50
    const baseMax = 20
    const baseAcc = 0.9
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: baseMaxHp,
        attacks: {
          melee: { accuracy: baseAcc, minDamage: 20, maxDamage: baseMax },
          ranged: { accuracy: baseAcc, minDamage: 2, maxDamage: 4 },
        },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    expect(result.current.hero.level).toBe(1)
    expect(result.current.hero.maxHp).toBe(baseMaxHp)

    clearDungeon(result)

    expect(result.current.hero.level).toBeGreaterThan(1)
    expect(result.current.hero.maxHp).toBeGreaterThan(baseMaxHp) // tougher
    expect(result.current.hero.attacks.melee.maxDamage).toBeGreaterThan(baseMax) // deadlier
    expect(result.current.hero.attacks.melee.accuracy).toBeGreaterThan(baseAcc) // more accurate
    expect(result.current.hero.attacks.ranged.maxDamage).toBeGreaterThan(4) // all attacks grow
    expect(result.current.hero.hp).toBeLessThanOrEqual(result.current.hero.maxHp) // heals never overfill
    expect(result.current.log.some((e) => /reach level 2/.test(e.text))).toBe(true)
  })

  it('pops a "Level N!" float over the hero on the turn it levels up', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 20, maxDamage: 20 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())

    let levelFloat = false
    for (
      let i = 0;
      i < 200 &&
      !levelFloat &&
      result.current.hero.level < 2 &&
      result.current.run.status === 'playing';
      i++
    ) {
      const foe = result.current.enemies[0]
      if (!foe) break
      const before = result.current.hero.level
      const dir = bfsDir(
        result.current.board.tiles,
        result.current.hero.position,
        { x: foe.x, y: foe.y },
        true,
      )
      if (!dir) break
      act(() => result.current.move(dir))
      if (result.current.hero.level > before) {
        const p = result.current.hero.position
        levelFloat = result.current.effects.some(
          (f) =>
            f.tone === 'level' &&
            f.x === p.x &&
            f.y === p.y &&
            f.amount === result.current.hero.level,
        )
      }
    }

    expect(result.current.hero.level).toBeGreaterThanOrEqual(2)
    expect(levelFloat).toBe(true)
  })

  it('starts a fresh delve back at level 1', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 50,
        attacks: { melee: { accuracy: 1, minDamage: 20, maxDamage: 20 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    clearDungeon(result)
    expect(result.current.hero.level).toBeGreaterThan(1)

    act(() => result.current.start()) // a new delve
    expect(result.current.hero.level).toBe(1)
    expect(result.current.hero.xp).toBe(0)
    expect(result.current.hero.maxHp).toBe(50)
  })
})

describe('useNoragon — descending', () => {
  it('taking the stairs goes deeper and carries the hero over', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 20, maxDamage: 20 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    expect(result.current.run.depth).toBe(1)
    clearDungeon(result) // fight through, leveling up on the way
    const levelBefore = result.current.hero.level
    const killsBefore = result.current.run.kills
    expect(levelBefore).toBeGreaterThan(1)

    // Walk onto the stairs, then deliberately descend.
    takeStairs(result)

    expect(result.current.run.depth).toBe(2)
    expect(result.current.run.status).toBe('playing')
    expect(result.current.hero.level).toBe(levelBefore) // progression carries over
    expect(result.current.run.kills).toBe(killsBefore) // a fresh level's foes are new
    expect(result.current.enemies.length).toBeGreaterThan(0) // and it's populated
    expect(result.current.log.some((e) => /descend the stairs to depth 2/.test(e.text))).toBe(true)
  })

  it('restarts at depth 1 on a fresh delve', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 20, maxDamage: 20 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    clearDungeon(result)
    takeStairs(result)
    expect(result.current.run.depth).toBe(2)

    act(() => result.current.start())
    expect(result.current.run.depth).toBe(1)
    expect(result.current.hero.level).toBe(1)
  })

  it('does not descend off the stairs (the stairs no longer auto-descend)', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 20, maxDamage: 20 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    clearDungeon(result)
    const stairs = findTile(result.current.board.tiles, 'stairs')
    expect(stairs).not.toBeNull()
    if (stairs) navigateToTile(result, stairs, false) // stand on the stairs

    expect(result.current.hero.onStairs).toBe(true)
    expect(result.current.run.depth).toBe(1) // just standing there doesn't descend
    act(() => result.current.descend()) // ...pressing descend does
    expect(result.current.run.depth).toBe(2)
  })
})

describe('useNoragon — new enemies', () => {
  it('seeds spiders early and unlocks orcs by the depth they allow', () => {
    // Depth 1: spiders show up, but orcs (min depth 3) and trolls (min depth 4)
    // are gated out.
    const shallow = new Set<string>()
    for (let seed = 1; seed <= 80; seed++) {
      const { result, unmount } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      for (const e of result.current.enemies) shallow.add(e.kind)
      unmount()
    }
    expect(shallow.has('spider')).toBe(true)
    expect(shallow.has('orc')).toBe(false)
    expect(shallow.has('troll')).toBe(false)

    // By depth 3, orcs start appearing (god-mode hero so we can descend; stop at
    // the first seed that proves it).
    let sawOrc = false
    for (let seed = 1; seed <= 30 && !sawOrc; seed++) {
      const { result, unmount } = renderHook(() =>
        useNoragon({
          maxHp: 9999,
          attacks: { melee: { accuracy: 1, minDamage: 99, maxDamage: 99 } },
          seed,
        }),
      )
      act(() => result.current.start())
      descendToDepth(result, 3)
      if (result.current.enemies.some((e) => e.kind === 'orc')) sawOrc = true
      unmount()
    }
    expect(sawOrc).toBe(true)
  })

  it('sends trolls to guard the deepest vaults', () => {
    // Deep pools are randomized, so scan seeds until one proves a troll reaches
    // depth 4 (they're common down there, so this resolves almost immediately).
    let sawTroll = false
    for (let seed = 1; seed <= 12 && !sawTroll; seed++) {
      const { result, unmount } = renderHook(() =>
        useNoragon({
          maxHp: 9999,
          attacks: { melee: { accuracy: 1, minDamage: 30, maxDamage: 30 } },
          seed,
        }),
      )
      act(() => result.current.start())
      descendToDepth(result, 4)
      if (result.current.run.depth >= 4 && result.current.enemies.some((e) => e.kind === 'troll')) {
        sawTroll = true
      }
      unmount()
    }
    expect(sawTroll).toBe(true)
  })

  it('unlocks the newer foes only at the depths their minDepth allows', () => {
    // Depth 1, many seeds: the depth-1 newcomers (kobold, dire wolf) turn up,
    // while skeleton (2), ogre (3), and wraith (4) are gated out.
    const shallow = new Set<string>()
    for (let seed = 1; seed <= 80; seed++) {
      const { result, unmount } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      for (const e of result.current.enemies) shallow.add(e.kind)
      unmount()
    }
    expect(shallow.has('kobold') || shallow.has('direWolf')).toBe(true)
    expect(shallow.has('skeleton')).toBe(false)
    expect(shallow.has('ogre')).toBe(false)
    expect(shallow.has('wraith')).toBe(false)
  })
})

const LOOT_SEEDS = [1, 7, 42, 99, 256, 4242, 5, 11, 77, 123, 2, 3, 8, 13, 21]

describe('useNoragon — loot & equipment', () => {
  it('starts the hero with a sword, clothes, gold, and a potion', () => {
    const { result } = renderHook(() => useNoragon({ seed: 7 }))
    act(() => result.current.start())

    const kinds = result.current.hero.inventory.map((i) => i.kind).sort()
    expect(kinds).toEqual(['clothes', 'healthPotion', 'shortSword'])

    const weapon = result.current.hero.inventory.find(
      (i) => i.id === result.current.hero.equipment.weapon,
    )
    const armor = result.current.hero.inventory.find(
      (i) => i.id === result.current.hero.equipment.armor,
    )
    expect(weapon?.kind).toBe('shortSword')
    expect(armor?.kind).toBe('clothes')

    // The equipped sword adds its +2 to melee; the clothes give their defense.
    expect(result.current.hero.attacks.melee.maxDamage).toBe(6 + ITEMS.shortSword.meleeDamage)
    expect(result.current.hero.defense).toBe(ITEMS.clothes.defense)
    expect(result.current.hero.gold).toBe(15)
  })

  it('equipping a found weapon retunes melee damage', () => {
    for (const seed of LOOT_SEEDS) {
      const { result, unmount } = renderHook(() =>
        useNoragon({
          maxHp: 999,
          attacks: { melee: { accuracy: 1, minDamage: 30, maxDamage: 30 } },
          seed,
        }),
      )
      act(() => result.current.start())
      const onFloor = result.current.board.floorItems.find(
        (i) => i.kind !== 'gold' && ITEMS[i.kind].category === 'weapon',
      )
      if (!onFloor || onFloor.kind === 'gold') {
        unmount()
        continue
      }
      const kind = onFloor.kind
      navigateToTile(result, { x: onFloor.x, y: onFloor.y }, false)
      const picked = result.current.hero.inventory.find(
        (i) => i.kind === kind && i.id !== result.current.hero.equipment.weapon,
      )
      if (!picked) {
        unmount()
        continue
      }
      const before = result.current.hero.attacks.melee.maxDamage
      act(() => result.current.equip(picked.id))
      // Equip is instant (no leveling between reads), so the change is exactly the
      // difference between the old Short Sword and the newly equipped weapon.
      expect(result.current.hero.attacks.melee.maxDamage - before).toBe(
        ITEMS[kind].meleeDamage - ITEMS.shortSword.meleeDamage,
      )
      unmount()
      return
    }
    throw new Error('no floor weapon found across seeds')
  })

  it('equipping found armor sets the hero’s defense', () => {
    for (const seed of LOOT_SEEDS) {
      const { result, unmount } = renderHook(() =>
        useNoragon({
          maxHp: 999,
          attacks: { melee: { accuracy: 1, minDamage: 30, maxDamage: 30 } },
          seed,
        }),
      )
      act(() => result.current.start())
      const onFloor = result.current.board.floorItems.find(
        (i) => i.kind !== 'gold' && ITEMS[i.kind].category === 'armor',
      )
      if (!onFloor || onFloor.kind === 'gold') {
        unmount()
        continue
      }
      const kind = onFloor.kind
      navigateToTile(result, { x: onFloor.x, y: onFloor.y }, false)
      const picked = result.current.hero.inventory.find(
        (i) => i.kind === kind && i.id !== result.current.hero.equipment.armor,
      )
      if (!picked) {
        unmount()
        continue
      }
      act(() => result.current.equip(picked.id))
      expect(result.current.hero.defense).toBe(ITEMS[kind].defense)
      unmount()
      return
    }
    throw new Error('no floor armor found across seeds')
  })

  it('picking up a gold pile adds to the purse', () => {
    for (const seed of LOOT_SEEDS) {
      const { result, unmount } = renderHook(() =>
        useNoragon({
          maxHp: 999,
          attacks: { melee: { accuracy: 1, minDamage: 30, maxDamage: 30 } },
          seed,
        }),
      )
      act(() => result.current.start())
      const pile = result.current.board.floorItems.find((i) => i.kind === 'gold')
      if (!pile) {
        unmount()
        continue
      }
      const before = result.current.hero.gold
      navigateToTile(result, { x: pile.x, y: pile.y }, false)
      if (result.current.hero.position.x !== pile.x || result.current.hero.position.y !== pile.y) {
        unmount()
        continue
      }
      expect(result.current.hero.gold).toBeGreaterThan(before)
      expect(result.current.board.floorItems.some((i) => i.id === pile.id)).toBe(false)
      unmount()
      return
    }
    throw new Error('no gold pile found across seeds')
  })

  it('drinking a potion heals the hero, is consumed, and costs a turn', () => {
    for (const seed of LOOT_SEEDS) {
      const { result, unmount } = renderHook(() =>
        useNoragon({
          maxHp: 30,
          attacks: { melee: { accuracy: 0, minDamage: 1, maxDamage: 1 } },
          seed,
        }),
      )
      act(() => result.current.start())
      const tough = result.current.enemies.find((e) => ENEMY_INFO[e.kind].damage > 1)
      if (!tough) {
        unmount()
        continue
      }
      // Let a hard-hitting foe wound the hero below a full potion's worth.
      for (
        let i = 0;
        i < 200 && result.current.hero.hp > 20 && result.current.run.status === 'playing';
        i++
      ) {
        const t = result.current.enemies.find((e) => e.id === tough.id)
        if (!t) break
        const dir = bfsDir(
          result.current.board.tiles,
          result.current.hero.position,
          { x: t.x, y: t.y },
          true,
        )
        if (!dir) break
        act(() => result.current.move(dir))
      }
      if (result.current.hero.hp > 20 || result.current.run.status !== 'playing') {
        unmount()
        continue
      }
      const potion = result.current.hero.inventory.find((i) => i.kind === 'healthPotion')
      if (!potion) {
        unmount()
        continue
      }
      const hpBefore = result.current.hero.hp
      const turnsBefore = result.current.run.turns
      act(() => result.current.drink(potion.id))
      expect(result.current.hero.hp).toBeGreaterThan(hpBefore)
      expect(result.current.hero.inventory.some((i) => i.id === potion.id)).toBe(false)
      expect(result.current.run.turns).toBe(turnsBefore + 1)
      unmount()
      return
    }
    throw new Error('could not set up a drink scenario across seeds')
  })

  it('carries the kit down the stairs but restocks a fresh delve', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 999,
        attacks: { melee: { accuracy: 1, minDamage: 30, maxDamage: 30 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    const goldStart = result.current.hero.gold
    descendToDepth(result, 2)
    expect(result.current.run.depth).toBe(2)
    // Gold/inventory persisted (gold only grows from loot on the way down).
    expect(result.current.hero.gold).toBeGreaterThanOrEqual(goldStart)

    act(() => result.current.start()) // fresh delve
    expect(result.current.hero.gold).toBe(15)
    expect(result.current.hero.inventory.map((i) => i.kind).sort()).toEqual([
      'clothes',
      'healthPotion',
      'shortSword',
    ])
  })
})

describe('enemy depth scaling', () => {
  const KINDS = ['bat', 'spider', 'goblin', 'orc', 'troll'] as const

  it('returns the bestiary baseline at depth 1', () => {
    for (const kind of KINDS) {
      const base = ENEMY_INFO[kind]
      expect(enemyStatsAt(kind, 1)).toEqual({
        maxHp: base.maxHp,
        accuracy: base.accuracy,
        damage: base.damage,
        xp: base.xp,
      })
    }
  })

  it('makes the same kind tougher and worth more the deeper it appears', () => {
    const shallow = enemyStatsAt('troll', 1)
    const deep = enemyStatsAt('troll', 6)
    expect(deep.maxHp).toBeGreaterThan(shallow.maxHp)
    expect(deep.damage).toBeGreaterThan(shallow.damage)
    expect(deep.accuracy).toBeGreaterThanOrEqual(shallow.accuracy)
    expect(deep.xp).toBeGreaterThan(shallow.xp)
  })

  it('never scales accuracy past the cap', () => {
    expect(enemyStatsAt('spider', 100).accuracy).toBeLessThanOrEqual(0.95)
  })

  it('keeps foes below their minimum spawn depth out of the shallow floors', () => {
    // Depth 1: no orcs (min depth 3) and no trolls (min depth 4) anywhere.
    for (const seed of SEEDS) {
      const { result } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      for (const foe of result.current.enemies) {
        expect(ENEMY_INFO[foe.kind].minDepth).toBeLessThanOrEqual(1)
      }
    }

    // Descend to depth 2 (god-mode hero): still no foes gated to depth 3+ (orcs,
    // skeletons) and certainly no trolls.
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 9999,
        attacks: { melee: { accuracy: 1, minDamage: 99, maxDamage: 99 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    descendToDepth(result, 2)
    expect(result.current.run.depth).toBe(2)
    for (const foe of result.current.enemies) {
      expect(ENEMY_INFO[foe.kind].minDepth).toBeLessThanOrEqual(2)
      expect(foe.kind).not.toBe('troll')
    }
  })

  it('spawns foes with their depth-scaled stats, stiffening as the run descends', () => {
    // A god-mode hero so we can clear levels and descend deterministically.
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 9999,
        attacks: { melee: { accuracy: 1, minDamage: 99, maxDamage: 99 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    // Depth 1: every foe carries exactly its baseline stats.
    expect(result.current.enemies.length).toBeGreaterThan(0)
    for (const foe of result.current.enemies) {
      expect({ maxHp: foe.maxHp, accuracy: foe.accuracy, damage: foe.damage, xp: foe.xp }).toEqual(
        enemyStatsAt(foe.kind, 1),
      )
    }

    descendToDepth(result, 3)
    expect(result.current.run.depth).toBe(3)
    // Depth 3: every foe carries its depth-3 (tougher) stats.
    for (const foe of result.current.enemies) {
      expect({ maxHp: foe.maxHp, accuracy: foe.accuracy, damage: foe.damage, xp: foe.xp }).toEqual(
        enemyStatsAt(foe.kind, 3),
      )
      // And a depth-3 foe is at least as sturdy as a depth-1 one of its kind.
      expect(foe.maxHp).toBeGreaterThanOrEqual(enemyStatsAt(foe.kind, 1).maxHp)
    }
  })
})

describe('ActivityLog colour-coding', () => {
  it('wraps the meaningful spans in toned marks', () => {
    const { container } = render(
      <ActivityLog
        entries={[
          { id: 0, text: 'You find 10 gold.' },
          { id: 1, text: 'The Goblin slashes you for 2.' },
          { id: 2, text: 'You collapse, slain in the dark.' },
        ]}
      />,
    )
    expect(container.querySelector('.noragon__log-mark--gold')?.textContent).toBe('10 gold')
    expect(container.querySelector('.noragon__log-mark--bad')?.textContent).toBe(
      'slashes you for 2',
    )
    expect(container.querySelector('.noragon__log-mark--death')?.textContent).toBe(
      'You collapse, slain in the dark.',
    )
  })
})

describe('useNoragon — shop', () => {
  // God-mode so the hero can punch through to the merchant without dying.
  const SHOP_OPTS = {
    seed: 7,
    maxHp: 9999,
    attacks: { melee: { accuracy: 1, minDamage: 99, maxDamage: 99 } },
  }

  it('opens by bumping the merchant and closes on leaving', () => {
    const { result } = renderHook(() => useNoragon(SHOP_OPTS))
    act(() => result.current.start())
    expect(openShop(result)).toBe(true)
    expect(result.current.shopping).toBe(true)
    act(() => result.current.closeShop())
    expect(result.current.shopping).toBe(false)
  })

  it('buys a stocked item, spending gold and adding it to the pack', () => {
    const { result } = renderHook(() => useNoragon(SHOP_OPTS))
    act(() => result.current.start())
    expect(openShop(result)).toBe(true)

    const item = result.current.shopStock[0]
    const price = buyPrice(ITEMS[item.kind].value)
    const goldBefore = result.current.hero.gold
    const packBefore = result.current.hero.inventory.length
    const stockBefore = result.current.shopStock.length
    expect(goldBefore).toBeGreaterThanOrEqual(price)

    act(() => result.current.buy(item.id))
    expect(result.current.hero.gold).toBe(goldBefore - price)
    expect(result.current.hero.inventory).toHaveLength(packBefore + 1)
    expect(result.current.shopStock).toHaveLength(stockBefore - 1)
    expect(result.current.shopStock.some((s) => s.id === item.id)).toBe(false)
  })

  it('sells a worn item for gold, unequipping it', () => {
    const { result } = renderHook(() => useNoragon(SHOP_OPTS))
    act(() => result.current.start())
    expect(openShop(result)).toBe(true)

    const armorId = result.current.hero.equipment.armor
    expect(armorId).not.toBeNull()
    if (armorId == null) return
    const worn = result.current.hero.inventory.find((i) => i.id === armorId)
    if (!worn) throw new Error('no worn armor')
    const price = sellPrice(ITEMS[worn.kind].value)
    const goldBefore = result.current.hero.gold

    act(() => result.current.sell(armorId))
    expect(result.current.hero.gold).toBe(goldBefore + price)
    expect(result.current.hero.equipment.armor).toBeNull()
    expect(result.current.hero.inventory.some((i) => i.id === armorId)).toBe(false)
  })
})

describe('Board combat floats', () => {
  const floor = (): TileType => 'floor'
  const board = {
    cols: 3,
    rows: 3,
    tiles: Array.from({ length: 3 }, () => Array.from({ length: 3 }, floor)),
    visible: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => true)),
    floorItems: [],
  }

  it('renders floating numbers with the right sign and tone', () => {
    const { container } = render(
      <Board
        board={board}
        hero={{ x: 0, y: 0 }}
        enemies={[]}
        aiming={false}
        targetId={null}
        effects={[
          { id: 1, x: 1, y: 1, amount: 5, tone: 'damage' },
          { id: 2, x: 0, y: 0, amount: 8, tone: 'heal' },
          { id: 3, x: 2, y: 2, amount: 0, tone: 'miss' },
        ]}
      />,
    )
    expect(container.querySelector('.noragon__float--damage')?.textContent).toBe('-5')
    expect(container.querySelector('.noragon__float--heal')?.textContent).toBe('+8')
    expect(container.querySelector('.noragon__float--miss')?.textContent).toBe('miss')
  })

  it('pops a "Level N!" number and a level-up ring on a level effect', () => {
    const { container } = render(
      <Board
        board={board}
        hero={{ x: 0, y: 0 }}
        enemies={[]}
        aiming={false}
        targetId={null}
        effects={[{ id: 1, x: 0, y: 0, amount: 3, tone: 'level' }]}
      />,
    )
    expect(container.querySelector('.noragon__float--level')?.textContent).toBe('Level 3!')
    expect(container.querySelector('.noragon__burst--level')).not.toBeNull()
  })

  it('renders no floats when there are none', () => {
    const { container } = render(
      <Board board={board} hero={{ x: 0, y: 0 }} enemies={[]} aiming={false} targetId={null} />,
    )
    expect(container.querySelector('.noragon__float')).toBeNull()
  })

  it('draws a rubble obstacle tile', () => {
    const tiles = board.tiles.map((row) => [...row])
    tiles[1][1] = 'rubble'
    const rubbleBoard = { ...board, tiles }
    const { container } = render(
      <Board
        board={rubbleBoard}
        hero={{ x: 0, y: 0 }}
        enemies={[]}
        aiming={false}
        targetId={null}
      />,
    )
    expect(container.querySelector('.noragon__tile--rubble')?.textContent).toBe('▲')
  })

  it('draws floor loot as a generic satchel, not its specific kind', () => {
    const floorItems: FloorItem[] = [{ id: 0, x: 2, y: 2, kind: 'longSword', amount: 1 }]
    const lootBoard = { ...board, floorItems }
    render(
      <Board board={lootBoard} hero={{ x: 0, y: 0 }} enemies={[]} aiming={false} targetId={null} />,
    )
    const loot = screen.getByTestId('loot')
    // The satchel hides the contents — no weapon glyph giving the type away.
    expect(loot.textContent).not.toBe(ITEMS.longSword.glyph)
    // And nothing tagged with the kind-specific test id of the old behavior.
    expect(screen.queryByTestId('loot-longSword')).not.toBeInTheDocument()
  })

  it('renders a fired arrow aimed at its target', () => {
    const { container } = render(
      <Board
        board={board}
        hero={{ x: 0, y: 0 }}
        enemies={[]}
        aiming={false}
        targetId={null}
        projectiles={[{ id: 1, fromX: 0, fromY: 0, toX: 2, toY: 0, kind: 'arrow' }]}
      />,
    )
    const arrow = container.querySelector('.noragon__arrow')
    expect(arrow).not.toBeNull()
    // A due-east shot points along 0°.
    expect(arrow?.getAttribute('style')).toContain('--arrow-angle: 0deg')
  })

  it('bursts only where a hit lands, delaying the burst under a fired arrow', () => {
    const { container } = render(
      <Board
        board={board}
        hero={{ x: 0, y: 0 }}
        enemies={[]}
        aiming={false}
        targetId={null}
        effects={[
          { id: 1, x: 1, y: 1, amount: 5, tone: 'damage' }, // melee/defense hit
          { id: 2, x: 2, y: 0, amount: 3, tone: 'damage' }, // the arrow's target
          { id: 3, x: 0, y: 0, amount: 8, tone: 'heal' }, // no burst
          { id: 4, x: 0, y: 1, amount: 0, tone: 'miss' }, // no burst
        ]}
        projectiles={[{ id: 9, fromX: 0, fromY: 0, toX: 2, toY: 0, kind: 'arrow' }]}
      />,
    )
    // One burst per damage float — heal and miss don't burst.
    expect(container.querySelectorAll('.noragon__burst')).toHaveLength(2)
    // The burst on the arrow's target tile waits for the arrow; the melee one doesn't.
    expect(container.querySelectorAll('.noragon__burst--delayed')).toHaveLength(1)
    // The number on the arrow's target tile also waits (so the burst leads it);
    // the heal at the hero's tile never waits on an arrow.
    expect(container.querySelectorAll('.noragon__float--delayed')).toHaveLength(1)
    expect(
      container.querySelector('.noragon__float--damage.noragon__float--delayed'),
    ).not.toBeNull()
    expect(container.querySelector('.noragon__float--heal.noragon__float--delayed')).toBeNull()
  })
})

describe('Shop overlay', () => {
  const noop = () => {}
  const bare = { weapon: null, armor: null, ring: null, amulet: null }

  it('disables buying what you cannot afford, and sells/leaves on click', () => {
    let sold: number | null = null
    let left = false
    render(
      <Shop
        stock={[{ id: 0, kind: 'longSword' }]} // value 22 → buy 28, unaffordable on 5
        gold={5}
        inventory={[{ id: 9, kind: 'healthPotion' }]}
        equipment={bare}
        onBuy={noop}
        onSell={(id) => {
          sold = id
        }}
        onLeave={() => {
          left = true
        }}
      />,
    )
    expect(within(screen.getByTestId('shop-buy')).getByRole('button')).toBeDisabled()
    // Rows describe their effect in a hover tooltip (CSS-hidden until hover).
    const tips = screen.getAllByRole('tooltip', { hidden: true }).map((t) => t.textContent)
    expect(tips).toContain('+3 damage · +5% accuracy') // Long Sword
    expect(tips).toContain('restores 10 HP') // Health Potion
    fireEvent.click(within(screen.getByTestId('shop-sell')).getByRole('button'))
    expect(sold).toBe(9)
    fireEvent.click(screen.getByRole('button', { name: /Leave/ }))
    expect(left).toBe(true)
  })

  it('enables buying when the hero can afford it', () => {
    let bought: number | null = null
    render(
      <Shop
        stock={[{ id: 0, kind: 'dagger' }]}
        gold={50}
        inventory={[]}
        equipment={bare}
        onBuy={(id) => {
          bought = id
        }}
        onSell={noop}
        onLeave={noop}
      />,
    )
    const buyBtn = within(screen.getByTestId('shop-buy')).getByRole('button')
    expect(buyBtn).not.toBeDisabled()
    fireEvent.click(buyBtn)
    expect(bought).toBe(0)
  })

  it('collapses stackable potions into one counted row in both lists', () => {
    render(
      <Shop
        stock={[
          { id: 0, kind: 'healthPotion' },
          { id: 1, kind: 'healthPotion' },
          { id: 2, kind: 'dagger' },
        ]}
        gold={100}
        inventory={[
          { id: 5, kind: 'healthPotion' },
          { id: 6, kind: 'healthPotion' },
          { id: 7, kind: 'healthPotion' },
          { id: 8, kind: 'shortSword' },
        ]}
        equipment={bare}
        onBuy={noop}
        onSell={noop}
        onLeave={noop}
      />,
    )
    // Potions collapse to one row each; gear stays per-item.
    expect(screen.getAllByTestId('shop-buy')).toHaveLength(2) // potion stack + dagger
    expect(screen.getAllByTestId('shop-sell')).toHaveLength(2) // potion stack + short sword
    expect(screen.getByText('(2)')).toBeInTheDocument() // 2 potions in stock
    expect(screen.getByText('(3)')).toBeInTheDocument() // 3 potions in pack
  })
})

describe('Inventory grouping', () => {
  const noop = () => {}

  it('collapses identical stackable potions into one counted row', () => {
    render(
      <Inventory
        inventory={[
          { id: 0, kind: 'healthPotion' },
          { id: 1, kind: 'healthPotion' },
          { id: 2, kind: 'healthPotion' },
        ]}
        equipment={{ weapon: null, armor: null, ring: null, amulet: null }}
        gold={0}
        onEquip={noop}
        onDrink={noop}
        onDrop={noop}
      />,
    )
    // One row for the three potions, showing the count, with a single Drink button.
    const rows = screen.getAllByTestId('inventory-item')
    expect(rows).toHaveLength(1)
    expect(screen.getByText('(3)')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Drink' })).toHaveLength(1)
  })

  it('keeps gear as one row per item, even when the kind matches', () => {
    render(
      <Inventory
        inventory={[
          { id: 0, kind: 'shortSword' },
          { id: 1, kind: 'shortSword' },
        ]}
        equipment={{ weapon: 0, armor: null, ring: null, amulet: null }}
        gold={0}
        onEquip={noop}
        onDrink={noop}
        onDrop={noop}
      />,
    )
    // Two separate rows — the equipped one tagged, the spare still equippable.
    expect(screen.getAllByTestId('inventory-item')).toHaveLength(2)
    expect(screen.getByText('Equipped')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Equip' })).toHaveLength(1)
  })

  it('tags a worn ring as equipped and offers to equip a spare amulet', () => {
    let equipped: number | null = null
    render(
      <Inventory
        inventory={[
          { id: 0, kind: 'ringOfProtection' }, // worn
          { id: 1, kind: 'amuletOfHealth' }, // spare
        ]}
        equipment={{ weapon: null, armor: null, ring: 0, amulet: null }}
        gold={0}
        onEquip={(id) => {
          equipped = id
        }}
        onDrink={noop}
        onDrop={noop}
      />,
    )
    expect(screen.getByText('Equipped')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Equip' }))
    expect(equipped).toBe(1)
  })

  it('describes each item’s effect in a hover tooltip', () => {
    render(
      <Inventory
        inventory={[
          { id: 0, kind: 'shortSword' },
          { id: 1, kind: 'healthPotion' },
          { id: 2, kind: 'amuletOfValor' },
        ]}
        equipment={{ weapon: 0, armor: null, ring: null, amulet: null }}
        gold={0}
        onEquip={noop}
        onDrink={noop}
        onDrop={noop}
      />,
    )
    // The tips are CSS-hidden until hover, so include hidden elements.
    const tips = screen.getAllByRole('tooltip', { hidden: true }).map((t) => t.textContent)
    expect(tips).toContain('+2 damage · +5% accuracy') // Short Sword
    expect(tips).toContain('restores 10 HP') // Health Potion
    expect(tips).toContain('+1 damage · +5% accuracy') // Amulet of Valor
  })

  it('drinks the first potion of a stack', () => {
    let drunk: number | null = null
    render(
      <Inventory
        inventory={[
          { id: 5, kind: 'healthPotion' },
          { id: 6, kind: 'healthPotion' },
        ]}
        equipment={{ weapon: null, armor: null, ring: null, amulet: null }}
        gold={0}
        onEquip={noop}
        onDrink={(id) => {
          drunk = id
        }}
        onDrop={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Drink' }))
    expect(drunk).toBe(5)
  })

  it('orders rows equipped first, then consumables, then spare gear', () => {
    render(
      <Inventory
        inventory={[
          { id: 0, kind: 'dagger' }, // spare weapon (unequipped)
          { id: 1, kind: 'healthPotion' }, // consumable
          { id: 2, kind: 'shortSword' }, // equipped weapon
          { id: 3, kind: 'leather' }, // equipped armor
        ]}
        equipment={{ weapon: 2, armor: 3, ring: null, amulet: null }}
        gold={0}
        onEquip={() => {}}
        onDrink={() => {}}
        onDrop={() => {}}
      />,
    )
    const names = screen.getAllByTestId('inventory-item').map((li) => li.textContent ?? '')
    // Equipped gear (sword, leather) → consumable (potion) → spare (dagger).
    expect(names[0]).toContain('Short Sword')
    expect(names[1]).toContain('Leather Armor')
    expect(names[2]).toContain('Health Potion')
    expect(names[3]).toContain('Dagger')
  })

  it('orders the unequipped spares alphabetically by name', () => {
    render(
      <Inventory
        inventory={[
          { id: 0, kind: 'plate' }, // "Plate Armor"
          { id: 1, kind: 'battleAxe' }, // "Battle Axe"
          { id: 2, kind: 'dagger' }, // "Dagger"
          { id: 3, kind: 'chainmail' }, // "Chainmail"
        ]}
        equipment={{ weapon: null, armor: null, ring: null, amulet: null }}
        gold={0}
        onEquip={() => {}}
        onDrink={() => {}}
        onDrop={() => {}}
      />,
    )
    const names = screen.getAllByTestId('inventory-item').map((li) => li.textContent ?? '')
    expect(names[0]).toContain('Battle Axe')
    expect(names[1]).toContain('Chainmail')
    expect(names[2]).toContain('Dagger')
    expect(names[3]).toContain('Plate Armor')
  })

  it('offers a Drop button on every row that reports the item id', () => {
    let dropped: number | null = null
    render(
      <Inventory
        inventory={[
          { id: 9, kind: 'dagger' },
          { id: 10, kind: 'healthPotion' },
        ]}
        equipment={{ weapon: null, armor: null, ring: null, amulet: null }}
        gold={0}
        onEquip={() => {}}
        onDrink={() => {}}
        onDrop={(id) => {
          dropped = id
        }}
      />,
    )
    const dropButtons = screen.getAllByRole('button', { name: 'Drop' })
    expect(dropButtons).toHaveLength(2) // one per row (the dagger and the potion)
    // Rows render consumables before spare gear, so the first Drop is the potion.
    fireEvent.click(dropButtons[0])
    expect(dropped).toBe(10)
  })
})

describe('useNoragon — drop', () => {
  it('discards an item for good, unequipping and re-deriving when it was worn', () => {
    const { result } = renderHook(() => useNoragon({ seed: 7 }))
    act(() => result.current.start())
    // Starting kit: shortSword (id 0, equipped), clothes (id 1, equipped), potion (id 2).
    expect(result.current.hero.defense).toBe(1) // Traveler's Clothes
    const turnsBefore = result.current.run.turns

    // Drop the spare potion: gone, and dropping is free — no turn, no enemy phase.
    act(() => result.current.drop(2))
    expect(result.current.hero.inventory.some((i) => i.id === 2)).toBe(false)
    expect(result.current.run.turns).toBe(turnsBefore)

    // Drop the worn armor: removed, the slot is cleared, and defense falls to 0.
    act(() => result.current.drop(1))
    expect(result.current.hero.inventory.some((i) => i.id === 1)).toBe(false)
    expect(result.current.hero.equipment.armor).toBeNull()
    expect(result.current.hero.defense).toBe(0)
  })
})

import { render, renderHook, act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Noragon } from './Noragon'
import { useNoragon } from './../game/useNoragon'
import type { NoragonApi, UseNoragonOptions } from './../game/useNoragon'
import { ENEMY_INFO } from '../game/enemies'
import type { Direction, Point, TileType } from '../game/types'

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
    if (!t || t === 'wall') return false
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
  for (let i = 0; i < cap && result.current.status === 'playing'; i++) {
    const p = result.current.player
    if (p.x === target.x && p.y === target.y) break
    const dir = bfsDir(result.current.tiles, p, target, blockChest)
    if (!dir) break
    act(() => result.current.move(dir))
  }
}

/** Walk toward `enemies[0]` until the hero shares a room with active enemies. */
function enterEnemyRoom(result: Hook, cap = 600) {
  for (let i = 0; i < cap && result.current.status === 'playing'; i++) {
    if (result.current.activeEnemies.length > 0) return
    const foe = result.current.enemies[0]
    if (!foe) return
    const dir = bfsDir(result.current.tiles, result.current.player, { x: foe.x, y: foe.y }, true)
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
  for (let i = 0; i < cap && result.current.status === 'playing'; i++) {
    if (result.current.activeEnemies.length >= 2) return
    const foe = result.current.enemies.find((e) => e.room === roomId)
    if (!foe) return
    const dir = bfsDir(result.current.tiles, result.current.player, { x: foe.x, y: foe.y }, true)
    if (!dir) return
    act(() => result.current.move(dir))
  }
}

/** Hunt down and kill every enemy on the level (never stepping on the chest). */
function clearDungeon(result: Hook, cap = 3000) {
  for (
    let i = 0;
    i < cap && result.current.enemies.length > 0 && result.current.status === 'playing';
    i++
  ) {
    const foe = result.current.enemies[0]
    if (!foe) break
    const dir = bfsDir(result.current.tiles, result.current.player, { x: foe.x, y: foe.y }, true)
    if (!dir) break
    act(() => result.current.move(dir))
  }
}

/** Compute the keystroke path to the first enemy room for a given run. */
function dirsToEnemyRoom(opts: UseNoragonOptions): Direction[] {
  const { result, unmount } = renderHook(() => useNoragon(opts))
  act(() => result.current.start())
  const dirs: Direction[] = []
  for (let i = 0; i < 200 && result.current.status === 'playing'; i++) {
    if (result.current.activeEnemies.length > 0) break
    const foe = result.current.enemies[0]
    if (!foe) break
    const dir = bfsDir(result.current.tiles, result.current.player, { x: foe.x, y: foe.y }, true)
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
    expect(screen.getByText('80%')).toBeInTheDocument() // melee accuracy
    expect(screen.getByText('3–6')).toBeInTheDocument() // damage range
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

    fireEvent.keyDown(window, { key: 'f' }) // loose the arrow
    expect(screen.queryByTestId('aim-banner')).not.toBeInTheDocument()
    expect(screen.getByTestId('activity-log')).toHaveTextContent('You shoot the')
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
    tiles: result.current.tiles.map((row) => row.join('')),
    player: result.current.player,
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
      return result.current.tiles.map((row) => row.join('')).join('\n')
    }
    const unique = new Set(SEEDS.map(fingerprint))
    expect(unique.size).toBeGreaterThan(1)
  })

  it('is always walled, holds exactly one chest, and is fully solvable', () => {
    for (const seed of SEEDS) {
      const { result } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      const { tiles, player } = result.current
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
      const corridors = result.current.tiles.flat().filter((t) => t === 'corridor').length
      expect(corridors).toBeGreaterThan(0)
    }
  })

  it('joins corridors to rooms only through doors (no double entryways)', () => {
    for (const seed of SEEDS) {
      const { result } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      const tiles = result.current.tiles
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
    const chest = findTile(result.current.tiles, 'chest')
    expect(chest).not.toBeNull()
    if (chest) navigateToTile(result, chest, false)

    // Having walked the passages to the vault, some corridor tiles are now lit
    // (no room reveals a corridor — only the torch trail does).
    const { tiles, visible } = result.current
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
    const chest = findTile(result.current.tiles, 'chest')
    expect(chest).not.toBeNull()

    // Step toward the chest until the hero is standing on a door tile.
    let onDoor = false
    for (let i = 0; i < 200 && result.current.status === 'playing'; i++) {
      const p = result.current.player
      if (result.current.tiles[p.y][p.x] === 'door') {
        onDoor = true
        break
      }
      if (!chest) break
      const dir = bfsDir(result.current.tiles, p, chest, false)
      if (!dir) break
      act(() => result.current.move(dir))
    }
    expect(onDoor).toBe(true)

    // The floor tiles on both sides of the doorway (both rooms) are now lit —
    // including the room the hero hasn't entered yet.
    const { player, tiles, visible } = result.current
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

  it('opening a chest grants treasure XP and consumes it', () => {
    // Sure-kill so the hero can fight to the vault; accuracy 0.9 leaves XP from
    // kills, but the chest's own XP shows up in the log and the tile is consumed.
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 20, maxDamage: 20 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    clearDungeon(result) // also clears the vault guardians

    const chest = findTile(result.current.tiles, 'chest')
    expect(chest).not.toBeNull()
    if (chest) navigateToTile(result, chest, false) // step onto the chest

    expect(findTile(result.current.tiles, 'chest')).toBeNull() // consumed
    expect(result.current.log.some((e) => /treasure! \(\+\d+ XP\)/.test(e.text))).toBe(true)
    expect(result.current.status).toBe('playing') // chests no longer end the run
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
      const dir = bfsDir(result.current.tiles, result.current.player, { x: foe.x, y: foe.y }, true)
      if (!dir) break
      act(() => result.current.move(dir))
    }

    expect(result.current.log.some((e) => /and miss\.$/.test(e.text))).toBe(true)
    expect(result.current.enemies.every((e) => e.hp === e.maxHp)).toBe(true)
  })

  it('keeps melee damage within the configured range', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 99,
        attacks: { melee: { accuracy: 1, minDamage: 3, maxDamage: 6 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    enterEnemyRoom(result)

    // Clear the room, bumping the nearest active foe each turn.
    for (let i = 0; i < 80 && result.current.activeEnemies.length > 0; i++) {
      const foe = result.current.activeEnemies[0]
      if (!foe) break
      const dir = bfsDir(result.current.tiles, result.current.player, { x: foe.x, y: foe.y }, true)
      if (!dir) break
      act(() => result.current.move(dir))
    }

    const damages: number[] = []
    for (const entry of result.current.log) {
      const m = entry.text.match(/^You strike the \w+ for (\d+)/)
      if (m) damages.push(Number(m[1]))
    }
    expect(damages.length).toBeGreaterThan(0)
    expect(damages.every((d) => d >= 3 && d <= 6)).toBe(true)
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
    const turnsBefore = result.current.turns

    act(() => result.current.fire())
    expect(result.current.aiming).toBe(false)
    expect(result.current.turns).toBe(turnsBefore + 1)
    expect(result.current.kills).toBeGreaterThan(0)
    expect(result.current.log.some((e) => /^You shoot the \w+ for 10/.test(e.text))).toBe(true)
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
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 1,
        attacks: { melee: { accuracy: 0, minDamage: 3, maxDamage: 6 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    enterEnemyRoom(result)

    for (let i = 0; i < 40 && result.current.status === 'playing'; i++) {
      const foe = result.current.activeEnemies[0]
      if (!foe) break
      const dir = bfsDir(result.current.tiles, result.current.player, { x: foe.x, y: foe.y }, true)
      if (!dir) break
      act(() => result.current.move(dir))
    }

    expect(result.current.status).toBe('dead')
    expect(result.current.hp).toBe(0)
  })

  it('makes the goblin tougher and harder-hitting than the bat', () => {
    expect(ENEMY_INFO.goblin.maxHp).toBeGreaterThan(ENEMY_INFO.bat.maxHp)
    expect(ENEMY_INFO.goblin.damage).toBeGreaterThan(ENEMY_INFO.bat.damage)
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
      const beforeP = result.current.player
      const beforeT = result.current.turns
      act(() => result.current.move('up'))
      if (
        result.current.player.x === beforeP.x &&
        result.current.player.y === beforeP.y &&
        result.current.turns === beforeT
      ) {
        bumped = true
        break
      }
    }
    expect(bumped).toBe(true)
    expect(result.current.status).toBe('playing')
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
      i < 60 && result.current.kills === 0 && result.current.status === 'playing';
      i++
    ) {
      const foe = result.current.enemies[0]
      if (!foe) break
      const dir = bfsDir(result.current.tiles, result.current.player, { x: foe.x, y: foe.y }, true)
      if (!dir) break
      act(() => result.current.move(dir))
    }

    expect(result.current.kills).toBe(1)
    expect(result.current.xp).toBeGreaterThan(0) // a single kill isn't enough to level
    expect(result.current.level).toBe(1)
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
    expect(result.current.level).toBe(1)
    expect(result.current.maxHp).toBe(baseMaxHp)

    clearDungeon(result)

    expect(result.current.level).toBeGreaterThan(1)
    expect(result.current.maxHp).toBeGreaterThan(baseMaxHp) // tougher
    expect(result.current.attacks.melee.maxDamage).toBeGreaterThan(baseMax) // deadlier
    expect(result.current.attacks.melee.accuracy).toBeGreaterThan(baseAcc) // more accurate
    expect(result.current.attacks.ranged.maxDamage).toBeGreaterThan(4) // all attacks grow
    expect(result.current.hp).toBeLessThanOrEqual(result.current.maxHp) // heals never overfill
    expect(result.current.log.some((e) => /reach level 2/.test(e.text))).toBe(true)
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
    expect(result.current.level).toBeGreaterThan(1)

    act(() => result.current.start()) // a new delve
    expect(result.current.level).toBe(1)
    expect(result.current.xp).toBe(0)
    expect(result.current.maxHp).toBe(50)
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
    expect(result.current.depth).toBe(1)
    clearDungeon(result) // fight through, leveling up on the way
    const levelBefore = result.current.level
    const killsBefore = result.current.kills
    expect(levelBefore).toBeGreaterThan(1)

    // Walk to the stairs and step down (stop the moment the depth changes).
    for (
      let i = 0;
      i < 800 && result.current.depth === 1 && result.current.status === 'playing';
      i++
    ) {
      const stairs = findTile(result.current.tiles, 'stairs')
      if (!stairs) break
      const dir = bfsDir(result.current.tiles, result.current.player, stairs, false)
      if (!dir) break
      act(() => result.current.move(dir))
    }

    expect(result.current.depth).toBe(2)
    expect(result.current.status).toBe('playing')
    expect(result.current.level).toBe(levelBefore) // progression carries over
    expect(result.current.kills).toBe(killsBefore) // a fresh level's foes are new
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
    for (
      let i = 0;
      i < 800 && result.current.depth === 1 && result.current.status === 'playing';
      i++
    ) {
      const stairs = findTile(result.current.tiles, 'stairs')
      if (!stairs) break
      const dir = bfsDir(result.current.tiles, result.current.player, stairs, false)
      if (!dir) break
      act(() => result.current.move(dir))
    }
    expect(result.current.depth).toBe(2)

    act(() => result.current.start())
    expect(result.current.depth).toBe(1)
    expect(result.current.level).toBe(1)
  })
})

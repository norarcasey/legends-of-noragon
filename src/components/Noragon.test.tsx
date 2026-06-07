import { render, renderHook, act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Noragon } from './Noragon'
import { useNoragon } from './../game/useNoragon'
import type { NoragonApi, UseNoragonOptions } from './../game/useNoragon'
import { ENEMY_INFO } from '../game/enemies'
import { ITEMS } from '../game/items'
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

/** Walk onto the stairs and take them down one level. */
function takeStairs(result: Hook) {
  const stairs = findTile(result.current.tiles, 'stairs')
  if (!stairs) return
  navigateToTile(result, stairs, false)
  if (result.current.onStairs) act(() => result.current.descend())
}

/** Clear each level and take the stairs until the run reaches `target` depth. */
function descendToDepth(result: Hook, target: number, cap = 25) {
  for (
    let d = 0;
    d < cap && result.current.depth < target && result.current.status === 'playing';
    d++
  ) {
    clearDungeon(result)
    const before = result.current.depth
    takeStairs(result)
    if (result.current.depth === before) break
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

    const goldBefore = result.current.gold
    const potionsBefore = result.current.inventory.filter((i) => i.kind === 'healthPotion').length
    const chest = findTile(result.current.tiles, 'chest')
    expect(chest).not.toBeNull()
    if (chest) navigateToTile(result, chest, false) // step onto the chest

    expect(findTile(result.current.tiles, 'chest')).toBeNull() // consumed
    expect(result.current.gold).toBeGreaterThan(goldBefore) // gold gained
    expect(
      result.current.inventory.filter((i) => i.kind === 'healthPotion').length,
    ).toBeGreaterThan(potionsBefore) // and a potion
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
    const lo = result.current.attacks.melee.minDamage
    const hi = result.current.attacks.melee.maxDamage

    // Bump foes while still level 1, so the effective range can't shift on us.
    for (
      let i = 0;
      i < 40 && result.current.level === 1 && result.current.activeEnemies.length > 0;
      i++
    ) {
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
    expect(damages.every((d) => d >= lo && d <= hi)).toBe(true)
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
    for (let i = 0; i < 300 && result.current.status === 'playing'; i++) {
      const t = result.current.enemies.find((e) => e.id === tough?.id)
      if (!t) break
      const dir = bfsDir(result.current.tiles, result.current.player, { x: t.x, y: t.y }, true)
      if (!dir) break
      act(() => result.current.move(dir))
    }

    expect(result.current.status).toBe('dead')
    expect(result.current.hp).toBe(0)
  })

  it('lets foes strike a hero loitering in a doorway (no safe poking)', () => {
    // Walk toward foes (accuracy 0, so nothing dies) and, the first time the hero
    // ends a step standing on a doorway/corridor (no room) with a foe right
    // beside it, confirm that foe is active and chips the hero. The old exploit
    // let the hero poke from such a tile — which belongs to no room — for free.
    const onDoorwayBesideFoe = (r: Hook) =>
      r.current.currentRoom === null &&
      r.current.enemies.some(
        (e) => Math.abs(e.x - r.current.player.x) + Math.abs(e.y - r.current.player.y) === 1,
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
        i < 400 && !onDoorwayBesideFoe(result) && result.current.status === 'playing';
        i++
      ) {
        const foe = result.current.enemies[0]
        if (!foe) break
        const dir = bfsDir(
          result.current.tiles,
          result.current.player,
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
      const hp0 = result.current.hp
      for (let i = 0; i < 25 && result.current.hp === hp0; i++) {
        const f = result.current.activeEnemies[0]
        if (!f) break
        const dir = bfsDir(result.current.tiles, result.current.player, { x: f.x, y: f.y }, false)
        if (!dir) break
        act(() => result.current.move(dir))
      }
      expect(result.current.hp).toBeLessThan(hp0)
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

    // Walk onto the stairs, then deliberately descend.
    takeStairs(result)

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
    takeStairs(result)
    expect(result.current.depth).toBe(2)

    act(() => result.current.start())
    expect(result.current.depth).toBe(1)
    expect(result.current.level).toBe(1)
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
    const stairs = findTile(result.current.tiles, 'stairs')
    expect(stairs).not.toBeNull()
    if (stairs) navigateToTile(result, stairs, false) // stand on the stairs

    expect(result.current.onStairs).toBe(true)
    expect(result.current.depth).toBe(1) // just standing there doesn't descend
    act(() => result.current.descend()) // ...pressing descend does
    expect(result.current.depth).toBe(2)
  })
})

describe('useNoragon — new enemies', () => {
  it('seeds spiders and orcs into the dungeon', () => {
    const kinds = new Set<string>()
    for (let seed = 1; seed <= 80; seed++) {
      const { result, unmount } = renderHook(() => useNoragon({ seed }))
      act(() => result.current.start())
      for (const e of result.current.enemies) kinds.add(e.kind)
      unmount()
    }
    expect(kinds.has('spider')).toBe(true)
    expect(kinds.has('orc')).toBe(true)
  })

  it('sends trolls to guard the deepest vaults', () => {
    const { result } = renderHook(() =>
      useNoragon({
        maxHp: 9999,
        attacks: { melee: { accuracy: 1, minDamage: 30, maxDamage: 30 } },
        seed: 7,
      }),
    )
    act(() => result.current.start())
    descendToDepth(result, 4)
    expect(result.current.depth).toBeGreaterThanOrEqual(4)
    expect(result.current.enemies.some((e) => e.kind === 'troll')).toBe(true)
  })
})

const LOOT_SEEDS = [1, 7, 42, 99, 256, 4242, 5, 11, 77, 123, 2, 3, 8, 13, 21]

describe('useNoragon — loot & equipment', () => {
  it('starts the hero with a sword, clothes, gold, and a potion', () => {
    const { result } = renderHook(() => useNoragon({ seed: 7 }))
    act(() => result.current.start())

    const kinds = result.current.inventory.map((i) => i.kind).sort()
    expect(kinds).toEqual(['clothes', 'healthPotion', 'shortSword'])

    const weapon = result.current.inventory.find((i) => i.id === result.current.equipment.weapon)
    const armor = result.current.inventory.find((i) => i.id === result.current.equipment.armor)
    expect(weapon?.kind).toBe('shortSword')
    expect(armor?.kind).toBe('clothes')

    // The equipped sword adds its +2 to melee; the clothes give their defense.
    expect(result.current.attacks.melee.maxDamage).toBe(6 + ITEMS.shortSword.meleeDamage)
    expect(result.current.defense).toBe(ITEMS.clothes.defense)
    expect(result.current.gold).toBe(15)
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
      const onFloor = result.current.floorItems.find(
        (i) => i.kind !== 'gold' && ITEMS[i.kind].category === 'weapon',
      )
      if (!onFloor || onFloor.kind === 'gold') {
        unmount()
        continue
      }
      const kind = onFloor.kind
      navigateToTile(result, { x: onFloor.x, y: onFloor.y }, false)
      const picked = result.current.inventory.find(
        (i) => i.kind === kind && i.id !== result.current.equipment.weapon,
      )
      if (!picked) {
        unmount()
        continue
      }
      const before = result.current.attacks.melee.maxDamage
      act(() => result.current.equip(picked.id))
      // Equip is instant (no leveling between reads), so the change is exactly the
      // difference between the old Short Sword and the newly equipped weapon.
      expect(result.current.attacks.melee.maxDamage - before).toBe(
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
      const onFloor = result.current.floorItems.find(
        (i) => i.kind !== 'gold' && ITEMS[i.kind].category === 'armor',
      )
      if (!onFloor || onFloor.kind === 'gold') {
        unmount()
        continue
      }
      const kind = onFloor.kind
      navigateToTile(result, { x: onFloor.x, y: onFloor.y }, false)
      const picked = result.current.inventory.find(
        (i) => i.kind === kind && i.id !== result.current.equipment.armor,
      )
      if (!picked) {
        unmount()
        continue
      }
      act(() => result.current.equip(picked.id))
      expect(result.current.defense).toBe(ITEMS[kind].defense)
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
      const pile = result.current.floorItems.find((i) => i.kind === 'gold')
      if (!pile) {
        unmount()
        continue
      }
      const before = result.current.gold
      navigateToTile(result, { x: pile.x, y: pile.y }, false)
      if (result.current.player.x !== pile.x || result.current.player.y !== pile.y) {
        unmount()
        continue
      }
      expect(result.current.gold).toBeGreaterThan(before)
      expect(result.current.floorItems.some((i) => i.id === pile.id)).toBe(false)
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
        i < 200 && result.current.hp > 20 && result.current.status === 'playing';
        i++
      ) {
        const t = result.current.enemies.find((e) => e.id === tough.id)
        if (!t) break
        const dir = bfsDir(result.current.tiles, result.current.player, { x: t.x, y: t.y }, true)
        if (!dir) break
        act(() => result.current.move(dir))
      }
      if (result.current.hp > 20 || result.current.status !== 'playing') {
        unmount()
        continue
      }
      const potion = result.current.inventory.find((i) => i.kind === 'healthPotion')
      if (!potion) {
        unmount()
        continue
      }
      const hpBefore = result.current.hp
      const turnsBefore = result.current.turns
      act(() => result.current.drink(potion.id))
      expect(result.current.hp).toBeGreaterThan(hpBefore)
      expect(result.current.inventory.some((i) => i.id === potion.id)).toBe(false)
      expect(result.current.turns).toBe(turnsBefore + 1)
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
    const goldStart = result.current.gold
    descendToDepth(result, 2)
    expect(result.current.depth).toBe(2)
    // Gold/inventory persisted (gold only grows from loot on the way down).
    expect(result.current.gold).toBeGreaterThanOrEqual(goldStart)

    act(() => result.current.start()) // fresh delve
    expect(result.current.gold).toBe(15)
    expect(result.current.inventory.map((i) => i.kind).sort()).toEqual([
      'clothes',
      'healthPotion',
      'shortSword',
    ])
  })
})

import type {
  Dungeon,
  DungeonShop,
  Enemy,
  FloorItem,
  Point,
  Room,
  ShopItem,
  TileType,
} from '../types'
import { ENEMY_INFO } from '../enemies'
import type { EnemyKind } from '../enemies'
import { AMULET_KINDS, ARMOR_KINDS, RING_KINDS, WEAPON_KINDS } from '../items'
import type { ItemKind } from '../items'
import { CELL, MAX_ROOM, MIN_CELLS, MIN_ROOM, ROOM_NAMES, SHOP } from '../constants'
import { makeRng } from './makeRng'
import { spawnEnemy } from './spawnEnemy'

// ---- Procedural dungeon generation ----------------------------------------
//
// The level is a grid of rooms joined by doorways. A seeded RNG picks the grid
// size, may omit some cells (keeping the rest connected), sizes each room, carves
// a spanning set of doors (so every room is reachable), drops the chest in the
// farthest room, and scatters enemies by depth. Rooms-on-a-grid keeps today's
// room model — fog of war, enemy confinement, and activation are all keyed on
// rooms — while making every run a different shape and size.
//
// Each room lives in a CELL×CELL slot (a MAX_ROOM interior plus one wall), sized
// MIN_ROOM..MAX_ROOM; an irregular footprint may omit cells but never drops below
// MIN_CELLS rooms. Those dimensions live in ../constants.

/**
 * Build the dungeon for the given `depth` of a run from `seed`: pick a grid size,
 * optionally omit some cells (keeping the rest connected), size each room, connect
 * them with a random spanning set of doors (plus a few loops), drop the chest in
 * the farthest room, and scatter enemies — tougher the deeper you go. The start
 * room stays safe and the vault is guarded. Deterministic: the same `(seed, depth)`
 * always yields the same map.
 */
export function generateDungeon(seed: number, depth: number): Dungeon {
  // A stream distinct from the combat RNG, varied per depth so each level differs.
  const rng = makeRng((seed ^ 0x9e3779b9 ^ (depth * 0x85ebca6b)) >>> 0)

  // Variable map size: a 3–4 × 3–4 grid of room slots.
  const gridCols = 3 + rng.int(2)
  const gridRows = 3 + rng.int(2)
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

  // One room becomes the merchant's shop — a safe stall, never the entrance or
  // the vault. (There are always ≥ MIN_CELLS rooms, so a candidate exists.)
  const shopChoices = cells.filter((c) => c !== startCell && c !== chestCell)
  const shopCell = shopChoices.length > 0 ? shopChoices[rng.int(shopChoices.length)] : -1

  // Size and record each room: a random size, freely placed within its slot.
  // Connections are corridors (carved below), so rooms needn't touch any wall.
  const axis = (lo: number): [number, number] => {
    const size = MIN_ROOM + rng.int(MAX_ROOM - MIN_ROOM + 1)
    const off = rng.int(MAX_ROOM - size + 1)
    return [lo + off, lo + off + size - 1]
  }
  const rooms: Room[] = []
  const cellToRoom = new Map<number, number>()
  let nameIdx = 0
  for (const cell of cells) {
    const s = slotOf(cell)
    const [x0, x1] = axis(s.x0)
    const [y0, y1] = axis(s.y0)
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

  const center = (room: Room): Point => ({
    x: Math.floor((room.x0 + room.x1) / 2),
    y: Math.floor((room.y0 + room.y1) / 2),
  })

  // Carve a corridor for each link: an L of passage tiles between the two rooms,
  // with a door where it meets each room. Only wall tiles become corridor, so it
  // never cuts through a room's floor. `carve` leaves room floor and doors alone.
  const roomOf = (cell: number) => rooms[cellToRoom.get(cell) ?? 0]
  const carve = (x: number, y: number) => {
    if (tiles[y][x] === 'wall') tiles[y][x] = 'corridor'
  }
  for (const c of cells) {
    for (const other of links.get(c) ?? []) {
      if (other <= c) continue
      const ra = roomOf(c)
      const rb = roomOf(other)
      if (gyOf(c) === gyOf(other)) {
        // Horizontal link: out A's right mouth, jog vertically in the GAP between
        // the rooms (never along a room's wall), then into B's left mouth.
        const ay = center(ra).y
        const by = center(rb).y
        const ax = ra.x1 + 1
        const bx = rb.x0 - 1
        const mx = ax + 1 + rng.int(bx - ax - 1) // strictly between the two mouths
        for (let x = ax; x <= mx; x++) carve(x, ay)
        const [ylo, yhi] = ay <= by ? [ay, by] : [by, ay]
        for (let y = ylo; y <= yhi; y++) carve(mx, y)
        for (let x = mx; x <= bx; x++) carve(x, by)
        tiles[ay][ax] = 'door'
        tiles[by][bx] = 'door'
      } else {
        // Vertical link: out A's bottom mouth, jog horizontally in the GAP, then
        // into B's top mouth.
        const ax = center(ra).x
        const bx = center(rb).x
        const ay = ra.y1 + 1
        const by = rb.y0 - 1
        const my = ay + 1 + rng.int(by - ay - 1) // strictly between the two mouths
        for (let y = ay; y <= my; y++) carve(ax, y)
        const [xlo, xhi] = ax <= bx ? [ax, bx] : [bx, ax]
        for (let x = xlo; x <= xhi; x++) carve(x, my)
        for (let y = my; y <= by; y++) carve(bx, y)
        tiles[ay][ax] = 'door'
        tiles[by][bx] = 'door'
      }
    }
  }
  const playerStart = center(roomOf(startCell))

  // Place the chest (the win tile) and an inert stairway beside it.
  const chestRoom = roomOf(chestCell)
  const chestAt = center(chestRoom)
  tiles[chestAt.y][chestAt.x] = 'chest'
  if (chestAt.x + 1 <= chestRoom.x1) tiles[chestAt.y][chestAt.x + 1] = 'stairs'

  // Stand a merchant at the centre of the shop room and stock the shelves: a
  // couple of health potions plus a few random pieces of gear. Bumping the
  // (impassable) merchant tile opens the shop. The room is left enemy-, rubble-,
  // and loot-free below so it stays a safe stall.
  let shop: DungeonShop | null = null
  if (shopCell !== -1) {
    const shopRoom = roomOf(shopCell)
    const merchant = center(shopRoom)
    tiles[merchant.y][merchant.x] = 'merchant'
    const gearPool: ItemKind[] = [...WEAPON_KINDS, ...ARMOR_KINDS, ...RING_KINDS, ...AMULET_KINDS]
    const stock: ShopItem[] = [
      { id: 0, kind: 'healthPotion' },
      { id: 1, kind: 'healthPotion' },
    ]
    while (stock.length < SHOP.stockSize) {
      stock.push({ id: stock.length, kind: gearPool[rng.int(gearPool.length)] })
    }
    shop = { room: shopRoom.id, merchant, stock }
  }

  // Scatter impassable rubble inside non-start rooms so combat has cover to
  // fight around. Each pile is a single tile kept off the room's central cross
  // (so the door mouths stay connected) and never orthogonally adjacent to
  // another pile (so an isolated pillar can never wall a corner off).
  for (const cell of cells) {
    if (cell === startCell || cell === shopCell) continue
    const room = roomOf(cell)
    const c = center(room)
    const spots: Point[] = []
    for (let y = room.y0; y <= room.y1; y++) {
      for (let x = room.x0; x <= room.x1; x++) {
        if (x !== c.x && y !== c.y && tiles[y][x] === 'floor') spots.push({ x, y })
      }
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = rng.int(i + 1)
      const tmp = spots[i]
      spots[i] = spots[j]
      spots[j] = tmp
    }
    const cap = Math.max(1, Math.floor(spots.length / 4))
    let placed = 0
    for (const s of spots) {
      if (placed >= cap) break
      const adjacent =
        tiles[s.y][s.x - 1] === 'rubble' ||
        tiles[s.y][s.x + 1] === 'rubble' ||
        tiles[s.y - 1][s.x] === 'rubble' ||
        tiles[s.y + 1][s.x] === 'rubble'
      if (adjacent) continue
      if (rng.next() < 0.5) {
        tiles[s.y][s.x] = 'rubble'
        placed++
      }
    }
  }

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
      enemies.push(spawnEnemy(rooms, kind, enemyId++, spot.x, spot.y, depth))
    }
  }
  // Keep heavy hitters out of the shallow floors: drop any kind whose minimum
  // spawn depth is below the current depth. Never empties (a bat is always
  // eligible), so every pool still has something to draw from.
  const eligible = (kinds: EnemyKind[]): EnemyKind[] => {
    const ok = kinds.filter((k) => ENEMY_INFO[k].minDepth <= depth)
    return ok.length > 0 ? ok : ['bat']
  }
  // Foes come from a pool that escalates with threat = a room's distance from the
  // entrance plus how deep the run is, with more of them the deeper you go.
  const rollKinds = (threat: number): EnemyKind[] => {
    const pool = eligible(
      threat >= 4
        ? ['goblin', 'orc', 'ogre', 'troll', 'wraith']
        : threat >= 3
          ? ['spider', 'goblin', 'skeleton', 'orc', 'ogre']
          : threat >= 2
            ? ['bat', 'spider', 'direWolf', 'skeleton', 'goblin']
            : ['bat', 'kobold', 'spider', 'direWolf'],
    )
    const count = threat >= 4 ? 3 : threat >= 2 ? 2 : 1
    const kinds: EnemyKind[] = []
    for (let i = 0; i < count; i++) kinds.push(pool[rng.int(pool.length)])
    return kinds
  }
  for (const cell of cells) {
    if (cell === startCell || cell === shopCell) continue
    if (cell === chestCell) {
      // The vault guardian grows nastier the deeper the run (within depth limits).
      placeIn(
        roomOf(cell),
        eligible(
          depth >= 4
            ? ['troll', 'wraith', 'orc']
            : depth >= 2
              ? ['orc', 'ogre', 'goblin']
              : ['goblin', 'skeleton', 'bat'],
        ),
      )
      continue
    }
    placeIn(roomOf(cell), rollKinds((dist.get(cell) ?? 1) + (depth - 1)))
  }

  // Scatter loot on free floor tiles: coin piles, the odd potion, and the rare
  // weapon or armor (better gear the deeper you are).
  const items: FloorItem[] = []
  let itemId = 0
  const dropIn = (room: Room, kind: ItemKind | 'gold', amount: number) => {
    const free: Point[] = []
    for (let y = room.y0; y <= room.y1; y++) {
      for (let x = room.x0; x <= room.x1; x++) {
        if (tiles[y][x] === 'floor' && !taken.has(`${x},${y}`)) free.push({ x, y })
      }
    }
    if (free.length === 0) return
    const spot = free.splice(rng.int(free.length), 1)[0]
    taken.add(`${spot.x},${spot.y}`)
    items.push({ id: itemId++, x: spot.x, y: spot.y, kind, amount })
  }
  const tierIndex = Math.min(WEAPON_KINDS.length - 1, rng.int(2) + Math.floor((depth - 1) / 2))
  for (const cell of cells) {
    if (cell === startCell || cell === shopCell) continue
    const room = roomOf(cell)
    if (rng.next() < 0.5) dropIn(room, 'gold', 3 + rng.int(6) + depth * 2)
    if (rng.next() < 0.2) dropIn(room, 'healthPotion', 1)
    if (rng.next() < 0.12) {
      const pool = rng.next() < 0.5 ? WEAPON_KINDS : ARMOR_KINDS
      dropIn(room, pool[tierIndex], 1)
    }
    // A rare trinket — a ring or amulet, picked at random (not tiered).
    if (rng.next() < 0.07) {
      const pool = rng.next() < 0.6 ? RING_KINDS : AMULET_KINDS
      dropIn(room, pool[rng.int(pool.length)], 1)
    }
  }

  return { cols, rows, tiles, rooms, playerStart, enemies, items, shop }
}

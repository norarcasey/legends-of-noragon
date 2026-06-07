import type { CSSProperties } from 'react'
import type { Enemy, FloorItem, Point, TileType } from '../game/types'
import { ENEMY_INFO } from '../game/enemies'
import { ITEMS } from '../game/items'

interface BoardProps {
  cols: number
  rows: number
  tiles: TileType[][]
  player: Point
  enemies: Enemy[]
  /** Loot on the floor, drawn on its tile when visible. */
  floorItems: FloorItem[]
  /** Fog-of-war mask (`visible[y][x]`); undiscovered tiles render as fog. */
  visible: boolean[][]
  /** Whether the hero is aiming; when true the targeted enemy shows a reticle. */
  aiming: boolean
  /** Id of the targeted enemy while aiming, else `null`. */
  targetId: number | null
}

const TILE_GLYPH: Record<TileType, string> = {
  wall: '',
  floor: '',
  corridor: '',
  door: '',
  chest: '▣',
  stairs: '>',
}

/**
 * Renders the dungeon as a fixed CSS grid of block tiles. The hero and any bats
 * are drawn on top of whatever tile they stand on, so the whole grid is a single
 * pass over `tiles` with the entities looked up per cell.
 */
export function Board({
  cols,
  rows,
  tiles,
  player,
  enemies,
  floorItems,
  visible,
  aiming,
  targetId,
}: BoardProps) {
  // `--noragon-cols` lets the CSS scale the glyph size to the column count, so
  // tiles stay legible whatever the (eventually procedural) board dimensions are.
  const gridStyle: CSSProperties & Record<string, string | number> = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    aspectRatio: `${cols} / ${rows}`,
    '--noragon-cols': cols,
  }

  const enemyAt = (x: number, y: number) => enemies.find((e) => e.x === x && e.y === y)
  const itemAt = (x: number, y: number) => floorItems.find((i) => i.x === x && i.y === y)

  return (
    <div className="noragon__board" style={gridStyle} data-testid="board" aria-hidden>
      {tiles.flatMap((row, y) =>
        row.map((tile, x) => {
          const isPlayer = player.x === x && player.y === y
          // The hero is always lit; everything else stays dark until discovered.
          const lit = isPlayer || visible[y]?.[x]
          if (!lit) {
            return <div key={`${x},${y}`} className="noragon__tile noragon__tile--hidden" />
          }
          const foe = enemyAt(x, y)
          const item = enemyAt(x, y) ? undefined : itemAt(x, y)
          let cls = `noragon__tile noragon__tile--${tile}`
          let glyph = TILE_GLYPH[tile]
          let testid: string | undefined
          if (isPlayer) {
            cls += ' noragon__tile--player'
            glyph = '☻'
            testid = 'player'
          } else if (foe) {
            cls += ` noragon__tile--enemy noragon__tile--${foe.kind}`
            glyph = ENEMY_INFO[foe.kind].glyph
            testid = `enemy-${foe.kind}`
            if (aiming && foe.id === targetId) cls += ' noragon__tile--target'
          } else if (item) {
            cls += ` noragon__tile--loot noragon__tile--loot-${item.kind}`
            glyph = item.kind === 'gold' ? '$' : ITEMS[item.kind].glyph
            testid = `loot-${item.kind}`
          }
          return (
            <div key={`${x},${y}`} className={cls} data-testid={testid}>
              {glyph}
            </div>
          )
        }),
      )}
    </div>
  )
}

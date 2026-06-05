import type { CSSProperties } from 'react'
import type { Enemy, Point, TileType } from '../game/types'

interface BoardProps {
  cols: number
  rows: number
  tiles: TileType[][]
  player: Point
  enemies: Enemy[]
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
  visible,
  aiming,
  targetId,
}: BoardProps) {
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    aspectRatio: `${cols} / ${rows}`,
  }

  const enemyAt = (x: number, y: number) => enemies.find((e) => e.x === x && e.y === y)

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
          const bat = enemyAt(x, y)
          let cls = `noragon__tile noragon__tile--${tile}`
          let glyph = TILE_GLYPH[tile]
          if (isPlayer) {
            cls += ' noragon__tile--player'
            glyph = '☻'
          } else if (bat) {
            cls += ' noragon__tile--bat'
            glyph = '𝕓'
            if (aiming && bat.id === targetId) cls += ' noragon__tile--target'
          }
          return (
            <div
              key={`${x},${y}`}
              className={cls}
              data-testid={isPlayer ? 'player' : bat ? 'bat' : undefined}
            >
              {glyph}
            </div>
          )
        }),
      )}
    </div>
  )
}

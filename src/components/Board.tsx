import type { CSSProperties } from 'react'
import type { Enemy, Point, TileType } from '../game/types'

interface BoardProps {
  cols: number
  rows: number
  tiles: TileType[][]
  player: Point
  enemies: Enemy[]
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
export function Board({ cols, rows, tiles, player, enemies }: BoardProps) {
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
          const bat = enemyAt(x, y)
          let cls = `noragon__tile noragon__tile--${tile}`
          let glyph = TILE_GLYPH[tile]
          if (isPlayer) {
            cls += ' noragon__tile--player'
            glyph = '☻'
          } else if (bat) {
            cls += ' noragon__tile--bat'
            glyph = '𝕓'
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

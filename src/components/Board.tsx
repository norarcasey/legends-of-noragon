import type { CSSProperties } from 'react'
import type { BoardView, Enemy, GameStatus, Point, TileType } from '../game/types'
import { ENEMY_INFO } from '../game/enemies'
import { ITEMS } from '../game/items'
import './Board.css'

export interface BoardProps {
  /** The board slice from the hook (`game.board`): dimensions, tiles, fog mask,
   *  and floor loot. */
  board: BoardView
  /** The hero's tile position (`game.hero.position`), drawn over its tile. */
  hero: Point
  /** Living enemies on the grid (`game.enemies`). */
  enemies: Enemy[]
  /** Whether the hero is aiming; shows the aim banner and the target's reticle. */
  aiming: boolean
  /** Id of the targeted enemy while aiming, else `null`. */
  targetId: number | null
  /** Run status (`game.run.status`) — drives the start/death overlay and gates the
   *  stairs prompt. Omit to render just the grid (no status-driven overlays). */
  status?: GameStatus
  /** Current depth, shown in the death overlay. */
  depth?: number
  /** Whether the hero stands on the stairs (`game.hero.onStairs`) — shows the
   *  descend prompt (with `onDescend`). */
  onStairs?: boolean
  /** Begin / restart the run (`game.start`) — shows the idle/death overlay. */
  onStart?: () => void
  /** Descend the stairs (`game.descend`) — shows the descend button. */
  onDescend?: () => void
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
 * Renders the dungeon as a fixed CSS grid of block tiles, plus the overlays that
 * belong over it: the aim banner, the stairs prompt, and the start/death overlay.
 * Each shows based on the state passed in (so they toggle with the run), and all
 * sit inside the board's own positioning context, so they cover only the grid.
 * The hero and foes are drawn on top of whatever tile they stand on.
 */
export function Board({
  board,
  hero,
  enemies,
  aiming,
  targetId,
  status,
  depth,
  onStairs,
  onStart,
  onDescend,
}: BoardProps) {
  const { cols, rows, tiles, visible, floorItems } = board
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
    <div className="noragon__board-wrap">
      <div className="noragon__board" style={gridStyle} data-testid="board" aria-hidden>
        {tiles.flatMap((row, y) =>
          row.map((tile, x) => {
            const isPlayer = hero.x === x && hero.y === y
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

      {aiming && (
        <div className="noragon__aim-banner" role="status" data-testid="aim-banner">
          Aiming — <kbd>Tab</kbd>/arrows switch · <kbd>Enter</kbd> fire · <kbd>F</kbd>/
          <kbd>Esc</kbd> cancel
        </div>
      )}

      {status === 'playing' && onStairs && !aiming && onDescend && (
        <div className="noragon__stairs-banner" role="status" data-testid="stairs-banner">
          <span>
            A stairway leads down. Press <kbd>&gt;</kbd> to descend.
          </span>
          <button type="button" className="noragon__descend-button" onClick={onDescend}>
            Descend ▾
          </button>
        </div>
      )}

      {status != null && status !== 'playing' && onStart && (
        <div className="noragon__overlay" role="status">
          {status === 'idle' && (
            <p className="noragon__message">Descend into the dungeon of Noragon</p>
          )}
          {status === 'dead' && <p className="noragon__message">You died at depth {depth}. 💀</p>}
          <button type="button" className="noragon__button" onClick={onStart}>
            {status === 'dead' ? 'Delve again' : 'Enter'}
          </button>
          <p className="noragon__hint">
            Arrow keys / WASD to move, F to aim (Enter to fire) — take the stairs to descend
          </p>
        </div>
      )}
    </div>
  )
}

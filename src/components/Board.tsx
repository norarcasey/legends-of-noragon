import type { CSSProperties } from 'react'
import type {
  BoardView,
  CombatFloat,
  Enemy,
  GameStatus,
  Point,
  Projectile,
  TileType,
} from '../game/types'
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
  /** Floating combat numbers (`game.effects`) to animate over their tiles. */
  effects?: CombatFloat[]
  /** Projectiles (`game.projectiles`) to animate travelling to their target. */
  projectiles?: Projectile[]
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
  effects,
  projectiles,
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

      {effects
        ?.filter((e) => e.tone === 'damage')
        .map((e) => {
          // Where the blow landed, a shockwave ring. A ranged hit's burst waits for
          // the arrow to reach the tile; melee and incoming hits burst at once.
          const ranged = projectiles?.some((p) => p.toX === e.x && p.toY === e.y)
          return (
            <span
              key={`burst-${e.id}`}
              className={`noragon__burst${ranged ? ' noragon__burst--delayed' : ''}`}
              style={{
                left: `${((e.x + 0.5) / cols) * 100}%`,
                top: `${((e.y + 0.5) / rows) * 100}%`,
              }}
              aria-hidden
            />
          )
        })}

      {effects?.map((e) => {
        // Text landing on a tile a fired arrow is reaching waits for the arrow.
        const ranged = e.tone !== 'heal' && projectiles?.some((p) => p.toX === e.x && p.toY === e.y)
        return (
          <span
            key={e.id}
            className={`noragon__float noragon__float--${e.tone}${
              ranged ? ' noragon__float--delayed' : ''
            }`}
            style={{
              left: `${((e.x + 0.5) / cols) * 100}%`,
              top: `${((e.y + 0.5) / rows) * 100}%`,
            }}
            aria-hidden
          >
            {e.tone === 'miss' ? 'miss' : `${e.tone === 'heal' ? '+' : '-'}${e.amount}`}
          </span>
        )
      })}

      {projectiles?.map((p) => {
        // Rotate the arrow glyph (which points east at 0°) to face its target.
        const angle = Math.atan2(p.toY - p.fromY, p.toX - p.fromX) * (180 / Math.PI)
        const style: CSSProperties & Record<string, string | number> = {
          '--arrow-from-x': `${((p.fromX + 0.5) / cols) * 100}%`,
          '--arrow-from-y': `${((p.fromY + 0.5) / rows) * 100}%`,
          '--arrow-to-x': `${((p.toX + 0.5) / cols) * 100}%`,
          '--arrow-to-y': `${((p.toY + 0.5) / rows) * 100}%`,
          '--arrow-angle': `${angle}deg`,
        }
        return (
          <span
            key={p.id}
            className={`noragon__arrow noragon__arrow--${p.kind}`}
            style={style}
            aria-hidden
          >
            ➤
          </span>
        )
      })}

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

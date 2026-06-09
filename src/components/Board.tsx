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
import { Shop } from './Shop'
import type { ShopProps } from './Shop'
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
  /** Foes slain this turn (`game.fadingEnemies`) — drawn briefly so they fade
   *  out where they fell instead of vanishing instantly. */
  fadingEnemies?: Enemy[]
  /** When set, the merchant's stall is shown as an overlay over the board.
   *  Build it from `game` while `game.shopping` (stock, gold, inventory, and the
   *  buy/sell/leave handlers); omit or pass `null` to hide it. */
  shop?: ShopProps | null
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
  rubble: '▲',
  merchant: '⚖',
}

/** Every floor pickup looks the same — a satchel — so its contents stay a
 *  surprise until the hero grabs it (the log reveals what it was). */
const LOOT_GLYPH = '💰'

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
  fadingEnemies,
  shop,
  status,
  depth,
  onStairs,
  onStart,
  onDescend,
}: BoardProps) {
  const { cols, rows, tiles, visible, floorItems } = board
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    aspectRatio: `${cols} / ${rows}`,
  }
  // `--noragon-cols` lets the CSS scale glyphs to the column count so they stay
  // legible at any board size. It lives on the wrap so both the grid tiles and
  // the enemy overlay (a sibling of the grid) inherit it.
  const wrapStyle: CSSProperties & Record<string, string | number> = {
    '--noragon-cols': cols,
  }

  const enemyAt = (x: number, y: number) => enemies.find((e) => e.x === x && e.y === y)
  const itemAt = (x: number, y: number) => floorItems.find((i) => i.x === x && i.y === y)
  const centre = (x: number, y: number) => ({
    left: `${((x + 0.5) / cols) * 100}%`,
    top: `${((y + 0.5) / rows) * 100}%`,
  })

  return (
    <div className="noragon__board-wrap" style={wrapStyle}>
      <div className="noragon__board" style={gridStyle} data-testid="board" aria-hidden>
        {tiles.flatMap((row, y) =>
          row.map((tile, x) => {
            const isPlayer = hero.x === x && hero.y === y
            // The hero is always lit; everything else stays dark until discovered.
            const lit = isPlayer || visible[y]?.[x]
            if (!lit) {
              return <div key={`${x},${y}`} className="noragon__tile noragon__tile--hidden" />
            }
            // Enemies are drawn in their own overlay (so they can animate
            // between tiles); a tile only hides loot a foe is standing on.
            const item = enemyAt(x, y) ? undefined : itemAt(x, y)
            let cls = `noragon__tile noragon__tile--${tile}`
            let glyph = TILE_GLYPH[tile]
            let testid: string | undefined
            if (isPlayer) {
              cls += ' noragon__tile--player'
              glyph = '☻'
              testid = 'player'
            } else if (item) {
              // Loot reads as a generic satchel — its contents are a surprise
              // revealed only in the log when the hero steps on it.
              cls += ' noragon__tile--loot'
              glyph = LOOT_GLYPH
              testid = 'loot'
            }
            return (
              <div key={`${x},${y}`} className={cls} data-testid={testid}>
                {glyph}
              </div>
            )
          }),
        )}
      </div>

      {enemies.map((e) => {
        // Only foes on a lit tile show. `--deferred` (set while an arrow flies)
        // holds a foe at its tile through the flight, then glides it to its new
        // one — so a struck foe doesn't step away before the arrow lands.
        if (!visible[e.y]?.[e.x]) return null
        const targeted = aiming && e.id === targetId
        return (
          <span
            key={e.id}
            className={`noragon__enemy noragon__enemy--${e.kind}${
              targeted ? ' noragon__enemy--target' : ''
            }${projectiles?.length ? ' noragon__enemy--deferred' : ''}`}
            style={centre(e.x, e.y)}
            data-testid={`enemy-${e.kind}`}
            aria-hidden
          >
            {ENEMY_INFO[e.kind].glyph}
          </span>
        )
      })}

      {fadingEnemies?.map((e) => (
        <span
          key={`dying-${e.id}`}
          className={`noragon__enemy noragon__enemy--${e.kind} noragon__enemy--dying`}
          style={centre(e.x, e.y)}
          aria-hidden
        >
          {ENEMY_INFO[e.kind].glyph}
        </span>
      ))}

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

      {shop ? <Shop {...shop} /> : null}
    </div>
  )
}

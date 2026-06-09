import type { GameStatus } from '../game/types'
import './Overlay.css'

export interface OverlayProps {
  /** Run status (`game.run.status`). The overlay shows while not `playing`. */
  status: GameStatus
  /** Current depth (`game.run.depth`), shown in the death message. */
  depth?: number
  /** Begin / restart the run (`game.start`). */
  onStart: () => void
}

/**
 * The full-cover start / death screen, shown whenever the run isn't in progress.
 * Rendered absolutely over its positioned parent — inside `<Noragon />` that's
 * the whole board frame (chrome included); on a standalone `<Board />` it covers
 * the grid. Returns nothing while playing.
 */
export function Overlay({ status, depth, onStart }: OverlayProps) {
  if (status === 'playing') return null
  return (
    <div className="noragon__overlay" role="status">
      {status === 'idle' && <p className="noragon__message">Descend into the dungeon of Noragon</p>}
      {status === 'dead' && <p className="noragon__message">You died at depth {depth}. 💀</p>}
      <button type="button" className="noragon__button" onClick={onStart}>
        {status === 'dead' ? 'Delve again' : 'Enter'}
      </button>
      <p className="noragon__hint">
        Arrow keys / WASD to move, F to aim (Enter to fire) — take the stairs to descend
      </p>
    </div>
  )
}

export default Overlay

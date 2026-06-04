import { useEffect } from 'react'
import { useNoragon } from '../game/useNoragon'
import type { Direction } from '../game/types'
import { Board } from './Board'
import './Noragon.css'

export interface NoragonProps {
  /** The hero's starting (and maximum) hit points. Default `6`. */
  maxHp?: number
  /** Move with the arrow keys / WASD. Default `true`. */
  enableKeyboard?: boolean
  /** Heading shown above the dungeon. Pass `null` to hide it. */
  title?: string | null
  /** Extra class on the root element. */
  className?: string
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

export function Noragon({
  maxHp,
  enableKeyboard = true,
  title = 'Legends of Noragon',
  className,
}: NoragonProps) {
  const game = useNoragon({ maxHp })
  const { status, start, move } = game

  useEffect(() => {
    if (!enableKeyboard) return

    const onKeyDown = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIRECTION[e.key]
      if (!dir) return
      e.preventDefault()
      // A direction key from a stopped dungeon both begins and takes the first step.
      if (status === 'playing') {
        move(dir)
      } else if (status === 'idle') {
        start()
        move(dir)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enableKeyboard, status, start, move])

  const isOver = status === 'won' || status === 'dead'

  return (
    <section
      className={`noragon${className ? ` ${className}` : ''}`}
      aria-label={title ?? 'Legends of Noragon dungeon crawler'}
    >
      <header className="noragon__header">
        {title !== null && <h2 className="noragon__title">{title}</h2>}
        <dl className="noragon__stats" aria-live="polite">
          <div className="noragon__stat">
            <dt>HP</dt>
            <dd>
              {game.hp}/{game.maxHp}
            </dd>
          </div>
          <div className="noragon__stat">
            <dt>Stamina</dt>
            <dd>
              {game.stamina}/{game.maxStamina}
            </dd>
          </div>
          <div className="noragon__stat">
            <dt>Slain</dt>
            <dd>{game.kills}</dd>
          </div>
        </dl>
      </header>

      <div className="noragon__stage">
        <Board
          cols={game.cols}
          rows={game.rows}
          tiles={game.tiles}
          player={game.player}
          enemies={game.enemies}
          visible={game.visible}
        />

        {status !== 'playing' && (
          <div className="noragon__overlay" role="status">
            {status === 'idle' && (
              <p className="noragon__message">Descend into the dungeon of Noragon</p>
            )}
            {status === 'won' && (
              <p className="noragon__message">You reached the chest — level cleared! 🗝️</p>
            )}
            {status === 'dead' && <p className="noragon__message">You died in the dark. 💀</p>}
            <button type="button" className="noragon__button" onClick={start}>
              {isOver ? 'Delve again' : 'Enter'}
            </button>
            <p className="noragon__hint">
              Move with the arrow keys or WASD — bump bats to slay them
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

export default Noragon

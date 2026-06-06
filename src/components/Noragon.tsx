import { useEffect } from 'react'
import { useNoragon } from '../game/useNoragon'
import type { AttackProfiles, Direction } from '../game/types'
import { ActivityLog } from './ActivityLog'
import { Board } from './Board'
import { EnemyCards } from './EnemyCards'
import './Noragon.css'

export interface NoragonProps {
  /** The hero's starting (and maximum) hit points. Default `6`. */
  maxHp?: number
  /** Override attack profiles; each provided kind replaces its default. Only
   *  `melee` affects play today (`ranged`/`spell` are reserved for later). */
  attacks?: Partial<AttackProfiles>
  /** Seed for the combat RNG; pass a fixed number for reproducible runs. */
  seed?: number
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
  attacks,
  seed,
  enableKeyboard = true,
  title = 'Legends of Noragon',
  className,
}: NoragonProps) {
  const game = useNoragon({ maxHp, attacks, seed })
  const melee = game.attacks.melee
  const { status, aiming, start, move, aimStart, aimCycle, aimCancel, fire } = game

  useEffect(() => {
    if (!enableKeyboard) return

    const onKeyDown = (e: KeyboardEvent) => {
      // ---- Aiming mode: arrows cycle targets, F/Enter fires, Esc cancels. ----
      if (aiming) {
        if (e.key === 'Escape') {
          e.preventDefault()
          aimCancel()
        } else if (e.key === 'f' || e.key === 'F' || e.key === 'Enter') {
          e.preventDefault()
          fire()
        } else if (e.key === 'Tab') {
          e.preventDefault()
          aimCycle(e.shiftKey ? -1 : 1)
        } else {
          const dir = KEY_TO_DIRECTION[e.key]
          if (!dir) return
          e.preventDefault()
          aimCycle(dir === 'up' || dir === 'left' ? -1 : 1)
        }
        return
      }

      // ---- Normal play: F starts aiming; directions move (and start). ----
      if (status === 'playing' && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        aimStart()
        return
      }

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
  }, [enableKeyboard, status, aiming, start, move, aimStart, aimCycle, aimCancel, fire])

  const isOver = status === 'won' || status === 'dead'

  return (
    <section
      className={`noragon${className ? ` ${className}` : ''}`}
      aria-label={title ?? 'Legends of Noragon dungeon crawler'}
    >
      {title !== null && <h2 className="noragon__title">{title}</h2>}

      <div className="noragon__layout">
        <div className="noragon__stage">
          <Board
            cols={game.cols}
            rows={game.rows}
            tiles={game.tiles}
            player={game.player}
            enemies={game.enemies}
            visible={game.visible}
            aiming={aiming}
            targetId={game.targetId}
          />

          {aiming && (
            <div className="noragon__aim-banner" role="status" data-testid="aim-banner">
              Aiming — <kbd>Tab</kbd>/arrows switch · <kbd>F</kbd> fire · <kbd>Esc</kbd> cancel
            </div>
          )}

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
                Move with the arrow keys or WASD — bump foes to strike, or press F to shoot
              </p>
            </div>
          )}
        </div>

        <aside className="noragon__panel">
          <dl className="noragon__stats" aria-live="polite">
            <div className="noragon__stat">
              <dt>Level</dt>
              <dd>{game.level}</dd>
            </div>
            <div className="noragon__stat">
              <dt>XP</dt>
              <dd>
                {game.xp}/{game.xpToNext}
              </dd>
            </div>
            <div className="noragon__stat">
              <dt>HP</dt>
              <dd>
                {game.hp}/{game.maxHp}
              </dd>
            </div>
            <div className="noragon__stat">
              <dt>Melee</dt>
              <dd>{Math.round(melee.accuracy * 100)}%</dd>
            </div>
            <div className="noragon__stat">
              <dt>Damage</dt>
              <dd>
                {melee.minDamage}–{melee.maxDamage}
              </dd>
            </div>
            <div className="noragon__stat">
              <dt>Slain</dt>
              <dd>{game.kills}</dd>
            </div>
          </dl>

          {status === 'playing' && (
            <EnemyCards enemies={game.activeEnemies} targetId={aiming ? game.targetId : null} />
          )}

          {status !== 'idle' && <ActivityLog entries={game.log} />}
        </aside>
      </div>
    </section>
  )
}

export default Noragon

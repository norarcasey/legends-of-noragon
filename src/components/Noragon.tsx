import type { ReactNode } from 'react'
import { useNoragon } from '../game/useNoragon'
import type { AttackProfiles } from '../game/types'
import { ActivityLog } from './ActivityLog'
import { Board } from './Board'
import { EnemyCards } from './EnemyCards'
import { Inventory } from './Inventory'
import { NoragonRoot } from './NoragonRoot'
import { Overlay } from './Overlay'
import { Shop } from './Shop'
import { useNoragonKeyboard } from './useNoragonKeyboard'
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
  /** Optional how-to-play / flavour shown on the start ("Delve") overlay, below
   *  the title. When given, it replaces the short default control hint there. */
  intro?: ReactNode
  /** Optional content for the bottom of the left info column — e.g. a credit or
   *  footnote. Sits below the enemy cards. */
  footer?: ReactNode
}

export function Noragon({
  maxHp,
  attacks,
  seed,
  enableKeyboard = true,
  title = 'Legends of Noragon',
  className,
  intro,
  footer,
}: NoragonProps) {
  const game = useNoragon({ maxHp, attacks, seed })
  const { board, hero, run } = game
  const { status } = run
  const { onStairs } = hero
  const { aiming, start, descend, disarm, equip, drink, drop } = game
  const { adjacentTrap } = game

  useNoragonKeyboard(game, { enabled: enableKeyboard })

  const shop = game.shopping
    ? {
        stock: game.shopStock,
        gold: hero.gold,
        inventory: hero.inventory,
        equipment: hero.equipment,
        onBuy: game.buy,
        onSell: game.sell,
        onLeave: game.closeShop,
      }
    : null

  // Player stats live in the board frame's margins (see Noragon.css): the run
  // tallies up top, the moment-to-moment combat numbers along the bottom.
  const melee = hero.attacks.melee
  const ranged = hero.attacks.ranged
  const topLeftStats: [string, string | number][] = [
    ['Depth', run.depth],
    ['Slain', run.kills],
  ]
  const topRightStats: [string, string | number][] = [
    ['HP', `${hero.hp}/${hero.maxHp}`],
    ['Gold', hero.gold],
    ['XP', `${hero.xp}/${hero.xpToNext}`],
  ]
  const bottomStats: [string, string | number][] = [
    ['Level', hero.level],
    ['Damage', `${melee.minDamage}–${melee.maxDamage}`],
    ['Melee', `${Math.round(melee.accuracy * 100)}%`],
    ['Range', `${Math.round(ranged.accuracy * 100)}%`],
    ['Defense', hero.defense],
  ]
  const chip = ([k, v]: [string, string | number]) => (
    <span className="noragon__chip" key={k}>
      <span className="noragon__chip-k">{k}</span>
      <span className="noragon__chip-v">{v}</span>
    </span>
  )

  // A prompt (if any) hangs off the bottom of the frame; flag the column so the
  // frame's bottom corners square off and the two read as one connected piece.
  const prompt: 'aim' | 'trap' | 'stairs' | null = aiming
    ? 'aim'
    : status === 'playing' && adjacentTrap
      ? 'trap'
      : status === 'playing' && onStairs
        ? 'stairs'
        : null

  return (
    <NoragonRoot className={className} ariaLabel={title ?? 'Legends of Noragon dungeon crawler'}>
      {title !== null && <h2 className="noragon__title">{title}</h2>}

      <div className="noragon__layout">
        <aside className="noragon__panel">
          {status !== 'idle' && <ActivityLog entries={game.log} />}

          {status === 'playing' && (
            <EnemyCards enemies={game.activeEnemies} targetId={aiming ? game.targetId : null} />
          )}
        </aside>

        <div className="noragon__divider" aria-hidden />

        <div className={`noragon__center${prompt ? ' noragon__center--prompted' : ''}`}>
          <div className="noragon__stage">
            <Board
              board={board}
              hero={hero.position}
              enemies={game.enemies}
              aiming={aiming}
              targetId={game.targetId}
              effects={game.effects}
              projectiles={game.projectiles}
              fadingEnemies={game.fadingEnemies}
              banners={false}
            />

            <div className="noragon__chrome noragon__chrome--top" aria-live="polite">
              <div className="noragon__chrome-group">{topLeftStats.map(chip)}</div>
              <div className="noragon__chrome-group">{topRightStats.map(chip)}</div>
            </div>
            <div className="noragon__chrome noragon__chrome--bottom" aria-live="polite">
              <div className="noragon__chrome-group">{bottomStats.map(chip)}</div>
            </div>

            {/* Full-frame overlays — cover the board and its chrome. */}
            <Overlay status={status} depth={run.depth} onStart={start} intro={intro} />
            {shop ? <Shop {...shop} /> : null}
          </div>

          {/* Prompts hang off the bottom of the frame, connected to it. */}
          {prompt === 'aim' ? (
            <div
              className="noragon__prompt noragon__prompt--aim"
              role="status"
              data-testid="aim-banner"
            >
              Aiming — <kbd>Tab</kbd>/arrows switch · <kbd>Enter</kbd> fire · <kbd>F</kbd>/
              <kbd>Esc</kbd> cancel
            </div>
          ) : prompt === 'trap' ? (
            <div className="noragon__prompt" role="status" data-testid="trap-banner">
              <span>
                A trap lies in wait. Press <kbd>E</kbd> to attempt a disarm.
              </span>
              <button
                type="button"
                className="noragon__descend-button"
                onClick={() => adjacentTrap && disarm(adjacentTrap)}
              >
                Disarm ✕
              </button>
            </div>
          ) : prompt === 'stairs' ? (
            <div className="noragon__prompt" role="status" data-testid="stairs-banner">
              <span>
                A stairway leads down. Press <kbd>&gt;</kbd> to descend.
              </span>
              <button type="button" className="noragon__descend-button" onClick={descend}>
                Descend ▾
              </button>
            </div>
          ) : null}
        </div>

        <div className="noragon__divider" aria-hidden />

        <aside className="noragon__info">
          {status !== 'idle' && (
            <Inventory
              inventory={hero.inventory}
              equipment={hero.equipment}
              gold={hero.gold}
              onEquip={equip}
              onDrink={drink}
              onDrop={drop}
            />
          )}

          {footer != null && <div className="noragon__note">{footer}</div>}
        </aside>
      </div>
    </NoragonRoot>
  )
}

export default Noragon

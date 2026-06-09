import type { ReactNode } from 'react'
import { useNoragon } from '../game/useNoragon'
import type { AttackProfiles } from '../game/types'
import { ActivityLog } from './ActivityLog'
import { Board } from './Board'
import { EnemyCards } from './EnemyCards'
import { Inventory } from './Inventory'
import { NoragonRoot } from './NoragonRoot'
import { Stats } from './Stats'
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
  /** Optional content for the top of the left info column — e.g. a description
   *  or how-to-play blurb. Sits above the enemy cards. */
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
  const { aiming, start, descend, equip, drink, drop } = game

  useNoragonKeyboard(game, { enabled: enableKeyboard })

  return (
    <NoragonRoot className={className} ariaLabel={title ?? 'Legends of Noragon dungeon crawler'}>
      {title !== null && <h2 className="noragon__title">{title}</h2>}

      <div className="noragon__layout">
        <aside className="noragon__info">
          {intro != null && <div className="noragon__intro">{intro}</div>}

          {status === 'playing' && (
            <EnemyCards enemies={game.activeEnemies} targetId={aiming ? game.targetId : null} />
          )}

          {footer != null && <div className="noragon__note">{footer}</div>}
        </aside>

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
            status={status}
            depth={run.depth}
            onStairs={onStairs}
            onStart={start}
            onDescend={descend}
          />

          <Stats hero={hero} run={run} />
        </div>

        <aside className="noragon__panel">
          {status !== 'idle' && <ActivityLog entries={game.log} />}

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
        </aside>
      </div>
    </NoragonRoot>
  )
}

export default Noragon

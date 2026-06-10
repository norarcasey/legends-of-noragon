import { ENEMY_INFO } from '../game/enemies'
import type { Enemy } from '../game/types'
import './EnemyCards.css'

/** Always show at least this many card slots, so the panel holds its shape, the
 *  cards stay a uniform size, and there are placeholders to flip when foes appear. */
const MIN_SLOTS = 4

export interface EnemyCardsProps {
  /** The active enemies to show cards for (`game.activeEnemies`). Empty slots
   *  render as skeleton placeholders that flip over when a foe fills them. */
  enemies: Enemy[]
  /** Id of the enemy currently targeted while aiming; its card is highlighted. */
  targetId?: number | null
}

/**
 * A row of cards for the foes the hero is engaged with — those sharing its room,
 * adjacent, or in a room peeked from a doorway — each showing the creature's
 * name, a short description, and a health bar. Until a foe occupies a slot the
 * card shows a skeleton placeholder (a Noragon roundel); when the hero enters a
 * room with enemies the placeholders flip over to reveal the details. While
 * aiming, the targeted enemy's card is highlighted.
 */
export function EnemyCards({ enemies, targetId = null }: EnemyCardsProps) {
  const slots = Math.max(MIN_SLOTS, enemies.length)

  return (
    <ul className="noragon__enemies" aria-label="Enemies in this room">
      {Array.from({ length: slots }, (_, i) => {
        const enemy = enemies[i]
        const info = enemy ? ENEMY_INFO[enemy.kind] : null
        const pct = enemy ? Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100)) : 0
        const targeted = enemy != null && enemy.id === targetId
        return (
          <li key={i} className="noragon__enemy-slot">
            <div className={`noragon__enemy-flip${enemy ? ' noragon__enemy-flip--revealed' : ''}`}>
              {/* Back: a patterned "card back" with the title, like a playing card. */}
              <div className="noragon__enemy-face noragon__enemy-face--back" aria-hidden>
                <span className="noragon__enemy-back-title">Legends of Noragon</span>
              </div>

              {/* Front: the enemy details, revealed by the flip. */}
              <div
                className={`noragon__enemy-face noragon__enemy-face--front${
                  enemy ? ` noragon__enemy-card--${enemy.kind}` : ''
                }${targeted ? ' noragon__enemy-card--targeted' : ''}`}
                data-testid={enemy ? 'enemy-card' : undefined}
                aria-current={targeted ? 'true' : undefined}
                aria-hidden={enemy ? undefined : true}
              >
                {enemy && info && (
                  <>
                    <div className="noragon__enemy-head">
                      <span className="noragon__enemy-name">{info.name}</span>
                      <span className="noragon__enemy-hp">
                        {enemy.hp}/{enemy.maxHp}
                      </span>
                    </div>
                    <p className="noragon__enemy-desc">{info.description}</p>
                    <div className="noragon__enemy-bar" role="presentation">
                      <div className="noragon__enemy-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

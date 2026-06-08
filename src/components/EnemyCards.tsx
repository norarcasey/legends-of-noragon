import { ENEMY_INFO } from '../game/enemies'
import type { Enemy } from '../game/types'

export interface EnemyCardsProps {
  /** The active enemies to show cards for (`game.activeEnemies`); nothing renders
   *  when empty. */
  enemies: Enemy[]
  /** Id of the enemy currently targeted while aiming; its card is highlighted. */
  targetId?: number | null
}

/**
 * A row of cards for the enemies sharing the hero's room — each showing the
 * creature's name, a short description, and a health bar. Mirrors the engine's
 * notion of "active": only enemies that can actually act appear here. While
 * aiming, the targeted enemy's card is highlighted.
 */
export function EnemyCards({ enemies, targetId = null }: EnemyCardsProps) {
  if (enemies.length === 0) return null

  return (
    <ul className="noragon__enemies" aria-label="Enemies in this room">
      {enemies.map((enemy) => {
        const info = ENEMY_INFO[enemy.kind]
        const pct = Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100))
        const targeted = enemy.id === targetId
        return (
          <li
            key={enemy.id}
            className={`noragon__enemy-card noragon__enemy-card--${enemy.kind}${
              targeted ? ' noragon__enemy-card--targeted' : ''
            }`}
            data-testid="enemy-card"
            aria-current={targeted ? 'true' : undefined}
          >
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
          </li>
        )
      })}
    </ul>
  )
}

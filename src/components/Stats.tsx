import type { HeroView, RunView } from '../game/types'

export interface StatsProps {
  /** The hero slice from the hook (`game.hero`): level, XP, HP, combat, gold. */
  hero: HeroView
  /** The run slice from the hook (`game.run`): depth and tallies. */
  run: RunView
}

/**
 * The character stat readout — depth, level, XP, HP, melee accuracy/damage,
 * defense, gold, and kills. A plain `<dl>` so it reads as a labelled list.
 */
export function Stats({ hero, run }: StatsProps) {
  const melee = hero.attacks.melee
  return (
    <dl className="noragon__stats" aria-live="polite">
      <div className="noragon__stat">
        <dt>Depth</dt>
        <dd>{run.depth}</dd>
      </div>
      <div className="noragon__stat">
        <dt>Level</dt>
        <dd>{hero.level}</dd>
      </div>
      <div className="noragon__stat">
        <dt>XP</dt>
        <dd>
          {hero.xp}/{hero.xpToNext}
        </dd>
      </div>
      <div className="noragon__stat">
        <dt>HP</dt>
        <dd>
          {hero.hp}/{hero.maxHp}
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
        <dt>Defense</dt>
        <dd>{hero.defense}</dd>
      </div>
      <div className="noragon__stat">
        <dt>Gold</dt>
        <dd>{hero.gold}</dd>
      </div>
      <div className="noragon__stat">
        <dt>Slain</dt>
        <dd>{run.kills}</dd>
      </div>
    </dl>
  )
}

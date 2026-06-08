import { describe, expect, it } from 'vitest'
import { statsAt } from './statsAt'
import { LEVELING } from './leveling'
import type { HeroStats } from '../types'

const base: HeroStats = {
  maxHp: 12,
  attacks: {
    melee: { accuracy: 0.8, minDamage: 3, maxDamage: 6 },
    ranged: { accuracy: 0.6, minDamage: 2, maxDamage: 4 },
    spell: { accuracy: 0.9, minDamage: 3, maxDamage: 6 },
  },
}

describe('statsAt', () => {
  it('returns the base profile at level 1', () => {
    expect(statsAt(base, 1)).toEqual(base)
  })

  it('raises max HP and every attack as the level climbs', () => {
    const s = statsAt(base, 3) // bonus 2
    expect(s.maxHp).toBe(12 + 2 * LEVELING.hpPerLevel)
    expect(s.attacks.melee.maxDamage).toBe(6 + 2 * LEVELING.damagePerLevel)
    expect(s.attacks.ranged.minDamage).toBe(2 + 2 * LEVELING.damagePerLevel)
  })

  it('does not mutate the base profile', () => {
    statsAt(base, 5)
    expect(base.maxHp).toBe(12)
    expect(base.attacks.melee.maxDamage).toBe(6)
  })
})

import { describe, expect, it } from 'vitest'
import { resolveAttack } from './resolveAttack'
import type { AttackProfile } from '../types'

const profile: AttackProfile = { accuracy: 0.8, minDamage: 3, maxDamage: 6 }

/** A roll() that yields the given values in order. */
const rolls = (...values: number[]) => {
  let i = 0
  return () => values[i++]
}

describe('resolveAttack', () => {
  it('misses when the to-hit roll is at or above accuracy', () => {
    expect(resolveAttack(profile, rolls(0.8))).toEqual({ hit: false, damage: 0 })
    expect(resolveAttack(profile, rolls(0.95))).toEqual({ hit: false, damage: 0 })
  })

  it('hits for the minimum when the damage roll is 0', () => {
    expect(resolveAttack(profile, rolls(0.1, 0))).toEqual({ hit: true, damage: 3 })
  })

  it('hits for the maximum when the damage roll is near 1', () => {
    // span = 6 - 3 + 1 = 4; floor(0.999 * 4) = 3 → 3 + 3 = 6
    expect(resolveAttack(profile, rolls(0.1, 0.999))).toEqual({ hit: true, damage: 6 })
  })

  it('keeps damage within the profile range', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const { damage } = resolveAttack(profile, rolls(0, r))
      expect(damage).toBeGreaterThanOrEqual(3)
      expect(damage).toBeLessThanOrEqual(6)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { leveledProfile } from './leveledProfile'
import { LEVELING } from './leveling'
import type { AttackProfile } from '../types'

const base: AttackProfile = { accuracy: 0.8, minDamage: 3, maxDamage: 6 }

describe('leveledProfile', () => {
  it('leaves the profile unchanged at bonus 0', () => {
    expect(leveledProfile(base, 0)).toEqual(base)
  })

  it('adds damage and accuracy per bonus level', () => {
    const p = leveledProfile(base, 2)
    expect(p.minDamage).toBe(3 + 2 * LEVELING.damagePerLevel)
    expect(p.maxDamage).toBe(6 + 2 * LEVELING.damagePerLevel)
    expect(p.accuracy).toBeCloseTo(0.8 + 2 * LEVELING.accuracyPerLevel)
  })

  it('caps accuracy at 1', () => {
    expect(leveledProfile({ accuracy: 0.98, minDamage: 1, maxDamage: 2 }, 50).accuracy).toBe(1)
  })
})

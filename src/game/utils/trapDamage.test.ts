import { describe, expect, it } from 'vitest'
import { trapDamage } from './trapDamage'
import { TRAP } from '../constants'

describe('trapDamage', () => {
  it('is the base damage at depth 1', () => {
    expect(trapDamage(1)).toBe(TRAP.damage)
  })

  it('grows by damagePerDepth with each level down', () => {
    expect(trapDamage(2)).toBe(TRAP.damage + TRAP.damagePerDepth)
    expect(trapDamage(5)).toBe(TRAP.damage + 4 * TRAP.damagePerDepth)
  })
})

import { describe, expect, it } from 'vitest'
import { deriveCombat } from './deriveCombat'
import { ITEMS } from '../items'
import type { Equipment, HeroStats, InventoryItem } from '../types'

const base: HeroStats = {
  maxHp: 12,
  attacks: {
    melee: { accuracy: 0.8, minDamage: 3, maxDamage: 6 },
    ranged: { accuracy: 0.6, minDamage: 2, maxDamage: 4 },
    spell: { accuracy: 0.9, minDamage: 3, maxDamage: 6 },
  },
}
const bare: Equipment = { weapon: null, armor: null }

describe('deriveCombat', () => {
  it('with no gear, returns the leveled base and zero defense', () => {
    const c = deriveCombat(base, 1, [], bare)
    expect(c.attacks.melee).toEqual(base.attacks.melee)
    expect(c.defense).toBe(0)
  })

  it('adds the equipped weapon bonus to melee', () => {
    const inv: InventoryItem[] = [{ id: 0, kind: 'shortSword' }]
    const c = deriveCombat(base, 1, inv, { weapon: 0, armor: null })
    expect(c.attacks.melee.minDamage).toBe(3 + ITEMS.shortSword.meleeDamage)
    expect(c.attacks.melee.maxDamage).toBe(6 + ITEMS.shortSword.meleeDamage)
    expect(c.attacks.melee.accuracy).toBeCloseTo(0.8 + ITEMS.shortSword.meleeAccuracy)
  })

  it('takes flat defense from the equipped armor', () => {
    const inv: InventoryItem[] = [{ id: 5, kind: 'leather' }]
    const c = deriveCombat(base, 1, inv, { weapon: null, armor: 5 })
    expect(c.defense).toBe(ITEMS.leather.defense)
  })
})

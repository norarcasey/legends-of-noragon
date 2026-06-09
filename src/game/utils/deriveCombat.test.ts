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
const bare: Equipment = { weapon: null, armor: null, ring: null, amulet: null }

describe('deriveCombat', () => {
  it('with no gear, returns the leveled base and zero defense', () => {
    const c = deriveCombat(base, 1, [], bare)
    expect(c.attacks.melee).toEqual(base.attacks.melee)
    expect(c.defense).toBe(0)
  })

  it('adds the equipped weapon bonus to melee', () => {
    const inv: InventoryItem[] = [{ id: 0, kind: 'shortSword' }]
    const c = deriveCombat(base, 1, inv, { ...bare, weapon: 0 })
    expect(c.attacks.melee.minDamage).toBe(3 + ITEMS.shortSword.meleeDamage)
    expect(c.attacks.melee.maxDamage).toBe(6 + ITEMS.shortSword.meleeDamage)
    expect(c.attacks.melee.accuracy).toBeCloseTo(0.8 + ITEMS.shortSword.meleeAccuracy)
  })

  it('takes flat defense from the equipped armor', () => {
    const inv: InventoryItem[] = [{ id: 5, kind: 'leather' }]
    const c = deriveCombat(base, 1, inv, { ...bare, armor: 5 })
    expect(c.defense).toBe(ITEMS.leather.defense)
  })

  it('stacks ring and amulet bonuses on top of weapon and armor', () => {
    const inv: InventoryItem[] = [
      { id: 0, kind: 'shortSword' },
      { id: 1, kind: 'leather' },
      { id: 2, kind: 'ringOfProtection' }, // +1 defense
      { id: 3, kind: 'amuletOfHealth' }, // +5 max HP
    ]
    const c = deriveCombat(base, 1, inv, { weapon: 0, armor: 1, ring: 2, amulet: 3 })
    expect(c.defense).toBe(ITEMS.leather.defense + ITEMS.ringOfProtection.defense)
    expect(c.maxHp).toBe(base.maxHp + ITEMS.amuletOfHealth.maxHp)
    expect(c.attacks.melee.minDamage).toBe(3 + ITEMS.shortSword.meleeDamage)
  })

  it('a ring of power raises melee damage with no weapon equipped', () => {
    const inv: InventoryItem[] = [{ id: 0, kind: 'ringOfPower' }]
    const c = deriveCombat(base, 1, inv, { ...bare, ring: 0 })
    expect(c.attacks.melee.minDamage).toBe(3 + ITEMS.ringOfPower.meleeDamage)
    expect(c.attacks.melee.maxDamage).toBe(6 + ITEMS.ringOfPower.meleeDamage)
  })
})

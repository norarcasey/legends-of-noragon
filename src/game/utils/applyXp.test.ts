import { describe, expect, it } from 'vitest'
import { applyXp } from './applyXp'
import { statsAt } from './statsAt'
import { xpToNext } from './xpToNext'
import type { Equipment, HeroStats, InventoryItem } from '../types'

const base: HeroStats = {
  maxHp: 12,
  attacks: {
    melee: { accuracy: 0.8, minDamage: 3, maxDamage: 6 },
    ranged: { accuracy: 0.6, minDamage: 2, maxDamage: 4 },
    spell: { accuracy: 0.9, minDamage: 3, maxDamage: 6 },
  },
}
const inv: InventoryItem[] = []
const bare: Equipment = { weapon: null, armor: null }

describe('applyXp', () => {
  it('accumulates XP without leveling below the threshold', () => {
    const msgs: string[] = []
    const r = applyXp(base, 1, 0, 12, 5, msgs, inv, bare)
    expect(r.level).toBe(1)
    expect(r.xp).toBe(5)
    expect(r.hp).toBe(12) // no level-up heal
    expect(msgs).toHaveLength(0)
  })

  it('levels up when the threshold is crossed, healing to the new max', () => {
    const msgs: string[] = []
    const gained = xpToNext(1) // exactly enough for level 2
    const r = applyXp(base, 1, 0, 1, gained, msgs, inv, bare)
    expect(r.level).toBe(2)
    expect(r.xp).toBe(0)
    expect(r.maxHp).toBe(statsAt(base, 2).maxHp)
    expect(r.hp).toBe(r.maxHp) // fully healed
    expect(msgs).toHaveLength(1)
  })

  it('can climb several levels from one big award and carries the remainder', () => {
    const msgs: string[] = []
    const gained = xpToNext(1) + xpToNext(2) + 7
    const r = applyXp(base, 1, 0, 1, gained, msgs, inv, bare)
    expect(r.level).toBe(3)
    expect(r.xp).toBe(7)
    expect(msgs).toHaveLength(2)
  })
})

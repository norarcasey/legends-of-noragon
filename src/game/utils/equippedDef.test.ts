import { describe, expect, it } from 'vitest'
import { equippedDef } from './equippedDef'
import { ITEMS } from '../items'
import type { InventoryItem } from '../types'

const inventory: InventoryItem[] = [
  { id: 0, kind: 'shortSword' },
  { id: 1, kind: 'clothes' },
]

describe('equippedDef', () => {
  it('returns null for an empty slot', () => {
    expect(equippedDef(inventory, null)).toBeNull()
  })

  it('returns the item def for an equipped id', () => {
    expect(equippedDef(inventory, 0)).toBe(ITEMS.shortSword)
    expect(equippedDef(inventory, 1)).toBe(ITEMS.clothes)
  })

  it('returns null when the id is not in the inventory', () => {
    expect(equippedDef(inventory, 99)).toBeNull()
  })
})

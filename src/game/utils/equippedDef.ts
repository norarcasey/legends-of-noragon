import type { InventoryItem } from '../types'
import { ITEMS } from '../items'
import type { ItemDef } from '../items'

/** The item def equipped in a slot (by item id), or null if the slot is empty. */
export function equippedDef(inventory: InventoryItem[], id: number | null): ItemDef | null {
  if (id === null) return null
  const item = inventory.find((i) => i.id === id)
  return item ? ITEMS[item.kind] : null
}

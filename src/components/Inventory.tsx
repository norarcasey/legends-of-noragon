import { ITEMS } from '../game/items'
import type { ItemKind } from '../game/items'
import type { Equipment, InventoryItem } from '../game/types'

interface InventoryProps {
  inventory: InventoryItem[]
  equipment: Equipment
  gold: number
  onEquip: (itemId: number) => void
  onDrink: (itemId: number) => void
}

/**
 * The hero's pack: gold, the currently equipped weapon/armor, and every carried
 * item. Gear is listed per-item (so distinct pieces stay individually
 * equippable), while stackable items like potions collapse into one counted row.
 */
export function Inventory({ inventory, equipment, gold, onEquip, onDrink }: InventoryProps) {
  // Gear keeps its own row each; stackables group by kind, preserving first-seen
  // order so the pack list stays stable as copies are gained and used.
  const gear = inventory.filter((i) => !ITEMS[i.kind].stackable)
  const stacks: { kind: ItemKind; items: InventoryItem[] }[] = []
  for (const item of inventory) {
    if (!ITEMS[item.kind].stackable) continue
    const existing = stacks.find((s) => s.kind === item.kind)
    if (existing) existing.items.push(item)
    else stacks.push({ kind: item.kind, items: [item] })
  }

  return (
    <section className="noragon__inventory" aria-label="Inventory" data-testid="inventory">
      <h3 className="noragon__inventory-title">Pack — ◉ {gold} gold</h3>
      <ul className="noragon__inventory-list">
        {gear.map((item) => {
          const def = ITEMS[item.kind]
          const equipped = equipment.weapon === item.id || equipment.armor === item.id
          return (
            <li
              key={item.id}
              className={`noragon__item${equipped ? ' noragon__item--equipped' : ''}`}
              data-testid="inventory-item"
            >
              <span className="noragon__item-glyph" aria-hidden>
                {def.glyph}
              </span>
              <span className="noragon__item-name">{def.name}</span>
              {equipped ? (
                <span className="noragon__item-tag">Equipped</span>
              ) : (
                <button
                  type="button"
                  className="noragon__item-button"
                  onClick={() => onEquip(item.id)}
                >
                  Equip
                </button>
              )}
            </li>
          )
        })}
        {stacks.map(({ kind, items }) => {
          const def = ITEMS[kind]
          const count = items.length
          return (
            <li key={`stack-${kind}`} className="noragon__item" data-testid="inventory-item">
              <span className="noragon__item-glyph" aria-hidden>
                {def.glyph}
              </span>
              <span className="noragon__item-name">
                {def.name}
                {count > 1 && <span className="noragon__item-count"> ({count})</span>}
              </span>
              {def.category === 'potion' && (
                <button
                  type="button"
                  className="noragon__item-button"
                  onClick={() => onDrink(items[0].id)}
                >
                  Drink
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

import { ITEMS } from '../game/items'
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
 * item with a button to equip gear or drink a potion.
 */
export function Inventory({ inventory, equipment, gold, onEquip, onDrink }: InventoryProps) {
  return (
    <section className="noragon__inventory" aria-label="Inventory" data-testid="inventory">
      <h3 className="noragon__inventory-title">Pack — ◉ {gold} gold</h3>
      <ul className="noragon__inventory-list">
        {inventory.map((item) => {
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
              {def.category === 'potion' ? (
                <button
                  type="button"
                  className="noragon__item-button"
                  onClick={() => onDrink(item.id)}
                >
                  Drink
                </button>
              ) : equipped ? (
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
      </ul>
    </section>
  )
}

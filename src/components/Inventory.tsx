import { ITEMS, itemEffect } from '../game/items'
import type { ItemKind } from '../game/items'
import type { Equipment, InventoryItem } from '../game/types'
import { HeroAvatar } from './HeroAvatar'
import { ItemIcon } from './ItemIcon'
import './Inventory.css'

export interface InventoryProps {
  /** The hero's carried items (`game.hero.inventory`). */
  inventory: InventoryItem[]
  /** Which item fills each equipment slot (`game.hero.equipment`). */
  equipment: Equipment
  /** Gold carried (`game.hero.gold`). */
  gold: number
  /** Equip a weapon/armor by id (`game.equip`). */
  onEquip: (itemId: number) => void
  /** Drink a potion by id (`game.drink`). */
  onDrink: (itemId: number) => void
  /** Discard an item by id (`game.drop`). */
  onDrop: (itemId: number) => void
}

/**
 * The hero's pack: gold, the currently equipped weapon/armor, and every carried
 * item. Gear is listed per-item (so distinct pieces stay individually
 * equippable), while stackable items like potions collapse into one counted row.
 *
 * Rows are ordered equipped gear first, then consumables, then spare gear — so
 * what's in use and what's quaffable sit at the top, with swap-in spares below.
 */
export function Inventory({
  inventory,
  equipment,
  gold,
  onEquip,
  onDrink,
  onDrop,
}: InventoryProps) {
  const isEquipped = (item: InventoryItem) =>
    equipment.weapon === item.id ||
    equipment.armor === item.id ||
    equipment.ring === item.id ||
    equipment.amulet === item.id

  // The kind worn in a slot (by item id), for the paper-doll avatar.
  const wornKind = (id: number | null) =>
    id == null ? null : (inventory.find((i) => i.id === id)?.kind ?? null)

  // An equipment slot beside the avatar: an SVG icon of the worn item + its
  // name, or a muted placeholder icon when empty. Used for the handheld gear
  // (weapon, ring); `fallbackKind` is the kind drawn (muted) for an empty slot.
  const equipSlot = (label: string, fallbackKind: ItemKind, id: number | null) => {
    const kind = wornKind(id)
    const def = kind ? ITEMS[kind] : null
    return (
      <div
        className={`noragon__equip-slot${def ? '' : ' noragon__equip-slot--empty'}`}
        data-testid={`equip-${label.toLowerCase()}`}
      >
        <ItemIcon kind={kind ?? fallbackKind} />
        <span className="noragon__equip-label">{def ? def.name : label}</span>
        {kind && (
          <span className="noragon__item-tip" role="tooltip">
            {itemEffect(kind)}
          </span>
        )}
      </div>
    )
  }

  // Gear keeps its own row each, split by whether it's worn; stackables group by
  // kind, preserving first-seen order so the pack list stays stable in use.
  const gear = inventory.filter((i) => !ITEMS[i.kind].stackable)
  const equipped = gear.filter(isEquipped)
  const unequipped = gear
    .filter((i) => !isEquipped(i))
    .sort((a, b) => ITEMS[a.kind].name.localeCompare(ITEMS[b.kind].name))
  const stacks: { kind: ItemKind; items: InventoryItem[] }[] = []
  for (const item of inventory) {
    if (!ITEMS[item.kind].stackable) continue
    const existing = stacks.find((s) => s.kind === item.kind)
    if (existing) existing.items.push(item)
    else stacks.push({ kind: item.kind, items: [item] })
  }

  const renderGear = (item: InventoryItem) => {
    const def = ITEMS[item.kind]
    const worn = isEquipped(item)
    return (
      <li
        key={item.id}
        className={`noragon__item${worn ? ' noragon__item--equipped' : ''}`}
        data-testid="inventory-item"
      >
        <span className="noragon__item-glyph" aria-hidden>
          {def.glyph}
        </span>
        <span className="noragon__item-name">{def.name}</span>
        <span className="noragon__item-actions">
          {worn ? (
            <span className="noragon__item-tag">Equipped</span>
          ) : (
            <button type="button" className="noragon__item-button" onClick={() => onEquip(item.id)}>
              Equip
            </button>
          )}
          <button
            type="button"
            className="noragon__item-button noragon__item-button--drop"
            onClick={() => onDrop(item.id)}
          >
            Drop
          </button>
        </span>
        <span className="noragon__item-tip" role="tooltip">
          {itemEffect(item.kind)}
        </span>
      </li>
    )
  }

  return (
    <section className="noragon__inventory" aria-label="Inventory" data-testid="inventory">
      <h3 className="noragon__inventory-title">Pack — ◉ {gold} gold</h3>
      <ul className="noragon__inventory-list">
        {equipped.map(renderGear)}
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
              <span className="noragon__item-actions">
                {def.category === 'potion' && (
                  <button
                    type="button"
                    className="noragon__item-button"
                    onClick={() => onDrink(items[0].id)}
                  >
                    Drink
                  </button>
                )}
                <button
                  type="button"
                  className="noragon__item-button noragon__item-button--drop"
                  onClick={() => onDrop(items[0].id)}
                >
                  Drop
                </button>
              </span>
              <span className="noragon__item-tip" role="tooltip">
                {itemEffect(kind)}
              </span>
            </li>
          )
        })}
        {unequipped.map(renderGear)}
      </ul>

      <div className="noragon__avatar-frame">
        <HeroAvatar armor={wornKind(equipment.armor)} amulet={wornKind(equipment.amulet)} />
        <div className="noragon__equip-slots">
          {equipSlot('Weapon', 'shortSword', equipment.weapon)}
          {equipSlot('Ring', 'ringOfProtection', equipment.ring)}
        </div>
      </div>
    </section>
  )
}

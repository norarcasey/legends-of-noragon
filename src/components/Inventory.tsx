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
 * Worn gear is pinned in its own list; everything unworn scrolls within a
 * fixed-height box (full-size from the start), so the worn gear and the hero
 * avatar beneath it stay in exactly the same spot no matter how much loot is
 * carried.
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
    equipment.rings.includes(item.id) ||
    equipment.amulet === item.id

  // The kind worn in a slot (by item id), for the paper-doll avatar.
  const wornKind = (id: number | null) =>
    id == null ? null : (inventory.find((i) => i.id === id)?.kind ?? null)

  // A portrait weapon slot: just the weapon's SVG when one is equipped, or a
  // muted placeholder icon over the "Weapon" label when empty.
  const weaponSlot = () => {
    const kind = wornKind(equipment.weapon)
    const def = kind ? ITEMS[kind] : null
    return (
      <div
        className={`noragon__weapon-slot${def ? '' : ' noragon__weapon-slot--empty'}`}
        data-testid="equip-weapon"
      >
        <ItemIcon kind={kind ?? 'shortSword'} />
        {!def && <span className="noragon__weapon-label">Weapon</span>}
        {kind && (
          <span className="noragon__item-tip" role="tooltip">
            {itemEffect(kind)}
          </span>
        )}
      </div>
    )
  }

  // A small ring slot showing a ring outline — gold when one's worn (its name +
  // effect on hover), muted when empty. Two of these sit under the weapon slot.
  const ringSlot = (i: number) => {
    const id = equipment.rings[i] ?? null
    const kind = wornKind(id)
    return (
      <div
        key={i}
        className={`noragon__ring-slot${kind ? '' : ' noragon__ring-slot--empty'}`}
        data-testid={`equip-ring-${i + 1}`}
      >
        <svg className="noragon__ring-outline" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </svg>
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

  const renderStack = ({ kind, items }: { kind: ItemKind; items: InventoryItem[] }) => {
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

      {/* Worn gear stays pinned at the top so it never scrolls out of focus. */}
      {equipped.length > 0 && (
        <ul className="noragon__inventory-list noragon__inventory-worn">
          {equipped.map(renderGear)}
        </ul>
      )}

      {/* Everything not worn — consumables and spare gear — scrolls within a
          capped box, keeping the worn gear and avatar below it in a fixed spot. */}
      <ul
        className="noragon__inventory-list noragon__inventory-spare"
        data-testid="inventory-spare"
      >
        {stacks.map(renderStack)}
        {unequipped.map(renderGear)}
      </ul>

      <div className="noragon__avatar-frame">
        <HeroAvatar armor={wornKind(equipment.armor)} amulet={wornKind(equipment.amulet)} />
        <div className="noragon__equip-slots">
          {weaponSlot()}
          <div className="noragon__ring-slots">{[0, 1].map((i) => ringSlot(i))}</div>
        </div>
      </div>
    </section>
  )
}

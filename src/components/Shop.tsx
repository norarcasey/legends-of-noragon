import { ITEMS, itemEffect } from '../game/items'
import type { ItemKind } from '../game/items'
import { buyPrice, sellPrice } from '../game/utils'
import type { Equipment, InventoryItem, ShopItem } from '../game/types'
import { ItemIcon } from './ItemIcon'
import './Shop.css'

/** Collapse stackable kinds (potions) into one counted row, preserving order;
 *  non-stackable gear stays one row each. Shared by the buy and sell lists. */
function group<T extends { id: number; kind: ItemKind }>(
  items: T[],
): { kind: ItemKind; items: T[] }[] {
  const out: { kind: ItemKind; items: T[] }[] = []
  for (const item of items) {
    const stack = ITEMS[item.kind].stackable ? out.find((g) => g.kind === item.kind) : undefined
    if (stack) stack.items.push(item)
    else out.push({ kind: item.kind, items: [item] })
  }
  return out
}

export interface ShopProps {
  /** What the merchant still has for sale (`game.shopStock`). */
  stock: ShopItem[]
  /** Gold the hero can spend (`game.hero.gold`). */
  gold: number
  /** The hero's carried items, offered back to the merchant (`game.hero.inventory`). */
  inventory: InventoryItem[]
  /** Equipment slots (`game.hero.equipment`) — worn pieces are tagged when sold. */
  equipment: Equipment
  /** Buy a stocked item by its shop id (`game.buy`). */
  onBuy: (stockId: number) => void
  /** Sell a carried item by its inventory id (`game.sell`). */
  onSell: (itemId: number) => void
  /** Leave the merchant, closing the shop (`game.closeShop`). */
  onLeave: () => void
}

/**
 * The merchant's stall, shown as an overlay over the board while trading. Buy
 * from the stock on the left (prices marked up; greyed out when you can't
 * afford them) and sell your wares on the right (for half their value). Trading
 * is free — no turn passes — and you leave with the button or Esc.
 */
export function Shop({ stock, gold, inventory, equipment, onBuy, onSell, onLeave }: ShopProps) {
  const isEquipped = (item: InventoryItem) =>
    equipment.weapon === item.id ||
    equipment.armor === item.id ||
    equipment.rings.includes(item.id) ||
    equipment.amulet === item.id

  return (
    <div className="noragon__shop" role="dialog" aria-label="Merchant" data-testid="shop">
      <div className="noragon__shop-head">
        <h3 className="noragon__shop-title">Merchant</h3>
        <span className="noragon__shop-gold">◉ {gold} gold</span>
      </div>

      <div className="noragon__shop-cols">
        <section className="noragon__shop-col" aria-label="For sale">
          <h4 className="noragon__shop-heading">Buy</h4>
          {stock.length === 0 ? (
            <p className="noragon__shop-empty">Sold out.</p>
          ) : (
            <ul className="noragon__shop-list">
              {group(stock).map((g) => {
                const def = ITEMS[g.kind]
                const price = buyPrice(def.value)
                const afford = gold >= price
                const count = g.items.length
                return (
                  <li key={g.items[0].id} className="noragon__shop-item" data-testid="shop-buy">
                    <span className="noragon__shop-glyph" aria-hidden>
                      <ItemIcon kind={g.kind} />
                    </span>
                    <span className="noragon__shop-name">
                      {def.name}
                      {count > 1 && <span className="noragon__shop-count"> ({count})</span>}
                    </span>
                    <button
                      type="button"
                      className="noragon__shop-button"
                      onClick={() => onBuy(g.items[0].id)}
                      disabled={!afford}
                    >
                      {price} ◉
                    </button>
                    <span className="noragon__shop-tip" role="tooltip">
                      {itemEffect(g.kind)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="noragon__shop-col" aria-label="Your wares">
          <h4 className="noragon__shop-heading">Sell</h4>
          {inventory.length === 0 ? (
            <p className="noragon__shop-empty">Nothing to sell.</p>
          ) : (
            <ul className="noragon__shop-list">
              {group(inventory).map((g) => {
                const def = ITEMS[g.kind]
                const count = g.items.length
                const worn = count === 1 && isEquipped(g.items[0])
                return (
                  <li key={g.items[0].id} className="noragon__shop-item" data-testid="shop-sell">
                    <span className="noragon__shop-glyph" aria-hidden>
                      <ItemIcon kind={g.kind} />
                    </span>
                    <span className="noragon__shop-name">
                      {def.name}
                      {worn && <span className="noragon__shop-worn"> (worn)</span>}
                      {count > 1 && <span className="noragon__shop-count"> ({count})</span>}
                    </span>
                    <button
                      type="button"
                      className="noragon__shop-button"
                      onClick={() => onSell(g.items[0].id)}
                    >
                      {sellPrice(def.value)} ◉
                    </button>
                    <span className="noragon__shop-tip" role="tooltip">
                      {itemEffect(g.kind)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <button type="button" className="noragon__shop-leave" onClick={onLeave}>
        Leave (Esc)
      </button>
    </div>
  )
}

export default Shop

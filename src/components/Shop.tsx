import { ITEMS } from '../game/items'
import { buyPrice, sellPrice } from '../game/utils'
import type { Equipment, InventoryItem, ShopItem } from '../game/types'
import './Shop.css'

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
    equipment.ring === item.id ||
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
              {stock.map((s) => {
                const def = ITEMS[s.kind]
                const price = buyPrice(def.value)
                const afford = gold >= price
                return (
                  <li key={s.id} className="noragon__shop-item" data-testid="shop-buy">
                    <span className="noragon__shop-glyph" aria-hidden>
                      {def.glyph}
                    </span>
                    <span className="noragon__shop-name">{def.name}</span>
                    <button
                      type="button"
                      className="noragon__shop-button"
                      onClick={() => onBuy(s.id)}
                      disabled={!afford}
                      title={afford ? undefined : 'Not enough gold'}
                    >
                      {price} ◉
                    </button>
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
              {inventory.map((item) => {
                const def = ITEMS[item.kind]
                const worn = isEquipped(item)
                return (
                  <li key={item.id} className="noragon__shop-item" data-testid="shop-sell">
                    <span className="noragon__shop-glyph" aria-hidden>
                      {def.glyph}
                    </span>
                    <span className="noragon__shop-name">
                      {def.name}
                      {worn && <span className="noragon__shop-worn"> (worn)</span>}
                    </span>
                    <button
                      type="button"
                      className="noragon__shop-button"
                      onClick={() => onSell(item.id)}
                    >
                      {sellPrice(def.value)} ◉
                    </button>
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

import { SHOP } from '../constants'

/** What the merchant charges for an item of the given base `value` (marked up,
 *  rounded up — at least 1 gold). */
export function buyPrice(value: number): number {
  return Math.max(1, Math.ceil(value * SHOP.buyMarkup))
}

/** What the merchant pays for an item of the given base `value` (a fraction of
 *  it, rounded down — at least 1 gold). */
export function sellPrice(value: number): number {
  return Math.max(1, Math.floor(value * SHOP.sellRate))
}

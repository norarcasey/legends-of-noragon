import { describe, expect, it } from 'vitest'
import { buyPrice, sellPrice } from './prices'

describe('shop prices', () => {
  it('marks up the buy price (rounded up, at least 1)', () => {
    expect(buyPrice(12)).toBe(15) // ceil(12 * 1.25)
    expect(buyPrice(8)).toBe(10)
    expect(buyPrice(0)).toBe(1) // never free
  })

  it('pays a fraction to sell (rounded down, at least 1)', () => {
    expect(sellPrice(12)).toBe(6) // floor(12 * 0.5)
    expect(sellPrice(5)).toBe(2)
    expect(sellPrice(1)).toBe(1) // floor(0.5) = 0, clamped to 1
  })

  it('buys high and sells low for the same item', () => {
    expect(buyPrice(22)).toBeGreaterThan(sellPrice(22))
  })
})

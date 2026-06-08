import { describe, expect, it } from 'vitest'
import { nextRng } from './nextRng'

describe('nextRng', () => {
  it('is deterministic for a given seed', () => {
    expect(nextRng(42)).toEqual(nextRng(42))
  })

  it('returns a value in [0, 1) and an integer state', () => {
    for (const seed of [0, 1, 42, 9999, 0x7fffffff]) {
      const { value, state } = nextRng(seed)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      expect(Number.isInteger(state)).toBe(true)
      expect(state).toBeGreaterThanOrEqual(0)
    }
  })

  it('advances: feeding the state back yields a different draw', () => {
    const a = nextRng(7)
    const b = nextRng(a.state)
    expect(b.value).not.toBe(a.value)
  })
})

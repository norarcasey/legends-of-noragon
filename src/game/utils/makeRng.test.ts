import { describe, expect, it } from 'vitest'
import { makeRng } from './makeRng'

describe('makeRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = makeRng(123)
    const b = makeRng(123)
    const seqA = [a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })

  it('int(n) stays within [0, n)', () => {
    const rng = makeRng(99)
    for (let i = 0; i < 200; i++) {
      const v = rng.int(6)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('advances between draws', () => {
    const rng = makeRng(5)
    expect(rng.next()).not.toBe(rng.next())
  })
})

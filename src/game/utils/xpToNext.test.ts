import { describe, expect, it } from 'vitest'
import { xpToNext } from './xpToNext'
import { LEVELING } from './leveling'

describe('xpToNext', () => {
  it('grows quadratically with level', () => {
    expect(xpToNext(1)).toBe(LEVELING.xpPerLevel) // 24 * 1²
    expect(xpToNext(2)).toBe(LEVELING.xpPerLevel * 4) // 24 * 2²
    expect(xpToNext(3)).toBe(LEVELING.xpPerLevel * 9) // 24 * 3²
  })

  it('costs strictly more at each higher level', () => {
    expect(xpToNext(3)).toBeGreaterThan(xpToNext(2))
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1))
  })
})

import { describe, expect, it } from 'vitest'
import { reveal } from './reveal'

describe('reveal', () => {
  it('appends a newly discovered room', () => {
    expect(reveal([0, 1], 2)).toEqual([0, 1, 2])
  })

  it('returns the same array reference when the room is null', () => {
    const seen = [0, 1]
    expect(reveal(seen, null)).toBe(seen)
  })

  it('returns the same array reference when the room is already known', () => {
    const seen = [0, 1]
    expect(reveal(seen, 1)).toBe(seen)
  })
})

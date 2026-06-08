import { describe, expect, it } from 'vitest'
import { manhattan } from './manhattan'

describe('manhattan', () => {
  it('is zero for the same point', () => {
    expect(manhattan({ x: 2, y: 3 }, { x: 2, y: 3 })).toBe(0)
  })

  it('sums the absolute x and y gaps', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7)
    expect(manhattan({ x: 5, y: 5 }, { x: 2, y: 7 })).toBe(5)
  })

  it('is 1 for orthogonally adjacent tiles', () => {
    expect(manhattan({ x: 1, y: 1 }, { x: 1, y: 2 })).toBe(1)
  })
})

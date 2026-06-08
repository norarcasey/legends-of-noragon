import { describe, expect, it } from 'vitest'
import { makeRoller } from './makeRoller'
import { nextRng } from './nextRng'

describe('makeRoller', () => {
  it('reads the seed as its state before any roll', () => {
    expect(makeRoller(42).state()).toBe(42)
  })

  it('matches advancing nextRng by hand from the seed', () => {
    const r = makeRoller(123)
    const first = nextRng(123)
    expect(r.roll()).toBe(first.value)
    expect(r.state()).toBe(first.state)
    const second = nextRng(first.state)
    expect(r.roll()).toBe(second.value)
    expect(r.state()).toBe(second.state)
  })

  it('two rollers with the same seed yield the same sequence', () => {
    const a = makeRoller(7)
    const b = makeRoller(7)
    expect([a.roll(), a.roll(), a.roll()]).toEqual([b.roll(), b.roll(), b.roll()])
  })
})

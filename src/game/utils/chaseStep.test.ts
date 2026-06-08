import { describe, expect, it } from 'vitest'
import { chaseStep } from './chaseStep'
import type { Enemy, Room } from '../types'

const rooms: Room[] = [{ id: 0, name: 'a', x0: 0, y0: 0, x1: 4, y1: 4 }]
const foe = (x: number, y: number): Enemy => ({
  id: 0,
  kind: 'bat',
  x,
  y,
  hp: 3,
  maxHp: 3,
  accuracy: 0.6,
  damage: 1,
  xp: 4,
  room: 0,
})

describe('chaseStep', () => {
  it('closes the larger gap first', () => {
    // dx = 3 (>= dy = 1), so it steps horizontally toward the target.
    expect(chaseStep(rooms, foe(0, 0), { x: 3, y: 1 }, new Set())).toEqual({ x: 1, y: 0 })
  })

  it('falls back to the other axis when the preferred step is occupied', () => {
    const occupied = new Set(['1,0']) // block the horizontal step
    expect(chaseStep(rooms, foe(0, 0), { x: 3, y: 1 }, occupied)).toEqual({ x: 0, y: 1 })
  })

  it('stays put when boxed in', () => {
    const occupied = new Set(['1,0', '0,1'])
    expect(chaseStep(rooms, foe(0, 0), { x: 3, y: 1 }, occupied)).toEqual({ x: 0, y: 0 })
  })

  it('never leaves its room', () => {
    // Target is outside the room to the left; the only step would exit, so it holds.
    expect(chaseStep(rooms, foe(0, 0), { x: -3, y: 0 }, new Set())).toEqual({ x: 0, y: 0 })
  })
})

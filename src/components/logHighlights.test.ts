import { describe, expect, it } from 'vitest'
import { splitLog } from './logHighlights'
import type { LogSegment } from './logHighlights'

/** The toned spans of a parsed line, as [text, tone] pairs. */
const toned = (text: string) =>
  splitLog(text)
    .filter((s: LogSegment) => s.tone)
    .map((s: LogSegment) => [s.text, s.tone])

const reassemble = (text: string) =>
  splitLog(text)
    .map((s) => s.text)
    .join('')

describe('splitLog', () => {
  it('always reassembles to the original line', () => {
    for (const line of [
      'You move east.',
      'You find 10 gold.',
      'The Goblin slashes you for 2.',
      'You strike the Bat for 5 — slain! (+12 XP)',
      'You drink a Health Potion and recover 8 HP.',
      'You reach level 3! You feel tougher and deadlier.',
      'You collapse, slain in the dark.',
    ]) {
      expect(reassemble(line)).toBe(line)
    }
  })

  it('leaves a plain line uncoloured', () => {
    expect(splitLog('You move east.')).toEqual([{ text: 'You move east.' }])
  })

  it('colours gold amounts', () => {
    expect(toned('You find 10 gold.')).toEqual([['10 gold', 'gold']])
    expect(toned('You pry open the chest — 18 gold and a Health Potion!')).toEqual([
      ['18 gold', 'gold'],
    ])
  })

  it('colours damage the hero takes (verb + amount) as bad', () => {
    expect(toned('The Goblin slashes you for 2.')).toEqual([['slashes you for 2', 'bad']])
  })

  it('colours kills, XP, heals, and held armor as good', () => {
    expect(toned('You strike the Bat for 5 — slain! (+12 XP)')).toEqual([
      ['slain', 'good'],
      ['+12 XP', 'good'],
    ])
    expect(toned('You drink a Health Potion and recover 8 HP.')).toEqual([['recover 8 HP', 'good']])
    expect(toned('The Orc cleaves you, but your armor holds.')).toEqual([
      ['your armor holds', 'good'],
    ])
  })

  it('colours level-ups', () => {
    expect(toned('You reach level 3! You feel tougher and deadlier.')).toEqual([
      ['level 3', 'level'],
    ])
  })

  it('treats a death line as a single death span (no green "slain")', () => {
    expect(splitLog('You collapse, slain in the dark.')).toEqual([
      { text: 'You collapse, slain in the dark.', tone: 'death' },
    ])
  })

  it('does not colour the hero dealing a non-killing blow', () => {
    expect(toned('You strike the Goblin for 3.')).toEqual([])
  })
})

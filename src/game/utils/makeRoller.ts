import { nextRng } from './nextRng'

/** A roller over the combat PRNG, seeded from the reducer's `rngState`: `roll()`
 *  yields the next value in [0, 1) and advances the stream; `state()` reads the
 *  current PRNG state to fold back into the next reducer state. Lets a turn draw
 *  many rolls while the reducer stays a pure function of (state, action). */
export function makeRoller(seed: number): { roll: () => number; state: () => number } {
  let s = seed
  return {
    roll: () => {
      const r = nextRng(s)
      s = r.state
      return r.value
    },
    state: () => s,
  }
}

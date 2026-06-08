import { nextRng } from './nextRng'

/** A tiny seeded RNG built on {@link nextRng}, for layout generation: `next()`
 *  yields a float in [0, 1) and `int(n)` an integer in [0, n). */
export function makeRng(seed: number) {
  let s = seed >>> 0
  const next = () => {
    const r = nextRng(s)
    s = r.state
    return r.value
  }
  return { next, int: (n: number) => Math.floor(next() * n) }
}

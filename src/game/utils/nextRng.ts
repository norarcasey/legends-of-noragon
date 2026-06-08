/**
 * A small deterministic PRNG (mulberry32). Kept pure and seeded from state so
 * the reducer stays a pure function of (state, action) — identical results under
 * StrictMode's double-invocation, and reproducible from a seed in tests.
 */
export function nextRng(seed: number): { value: number; state: number } {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, state: t >>> 0 }
}

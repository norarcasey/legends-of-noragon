import { TRAP } from '../constants'

/** Flat, armor-piercing damage a sprung trap deals at a given depth — the same
 *  for the hero or a foe that blunders onto it. Grows the deeper the run. */
export function trapDamage(depth: number): number {
  return TRAP.damage + (depth - 1) * TRAP.damagePerDepth
}

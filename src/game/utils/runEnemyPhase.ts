import type { Dungeon, Enemy, Point } from '../types'
import { ENEMY_INFO } from '../enemies'
import { isActiveFoe } from './isActiveFoe'
import { manhattan } from './manhattan'
import { chaseStep } from './chaseStep'

/**
 * Run the enemy phase: every foe sharing the hero's room either attacks (if
 * adjacent, rolling its own accuracy for its own damage) or chases one step.
 * Mutates `messages` and draws from the shared `roll`; returns the foes' new
 * positions, the hero's remaining hp, and how many adjacent foes whiffed. Used
 * by both moving and firing so a turn always ends the same way.
 */
export function runEnemyPhase(
  dungeon: Dungeon,
  player: Point,
  enemies: Enemy[],
  hp: number,
  defense: number,
  roll: () => number,
  messages: string[],
  engaged: number[] = [],
): { enemies: Enemy[]; hp: number; misses: number } {
  const occupied = new Set(enemies.map((e) => `${e.x},${e.y}`))
  // Rubble blocks foes too — treat each pile as permanently occupied so a chaser
  // steps around it (via its other axis) rather than onto it.
  for (let y = 0; y < dungeon.rows; y++) {
    for (let x = 0; x < dungeon.cols; x++) {
      if (dungeon.tiles[y][x] === 'rubble') occupied.add(`${x},${y}`)
    }
  }
  const moved: Enemy[] = []
  let nextHp = hp
  // How many adjacent foes whiffed this phase, so the reducer can float a "miss".
  let misses = 0

  for (const foe of enemies) {
    if (!isActiveFoe(dungeon.rooms, player, foe, engaged)) {
      moved.push(foe)
      continue
    }
    if (manhattan(foe, player) === 1) {
      // Adjacent: the foe rolls to land its attack — armor soaks a flat amount,
      // never below zero. Accuracy/damage are the foe's own depth-scaled stats;
      // the bestiary still supplies its name and verb. Fires even in a doorway.
      const info = ENEMY_INFO[foe.kind]
      if (roll() < foe.accuracy) {
        const dealt = Math.max(0, foe.damage - defense)
        nextHp -= dealt
        messages.push(
          dealt > 0
            ? `The ${info.name} ${info.verb} you for ${dealt}.`
            : `The ${info.name} ${info.verb} you, but your armor holds.`,
        )
      } else {
        misses++
        messages.push(`The ${info.name} misses you.`)
      }
      moved.push(foe)
      continue
    }
    // Otherwise chase. Reserve the destination so two foes can't stack.
    occupied.delete(`${foe.x},${foe.y}`)
    const step = chaseStep(dungeon.rooms, foe, player, occupied)
    occupied.add(`${step.x},${step.y}`)
    moved.push({ ...foe, x: step.x, y: step.y })
  }

  return { enemies: moved, hp: nextHp, misses }
}

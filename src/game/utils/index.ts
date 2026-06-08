// Barrel for the self-contained game utilities. Each function lives in its own
// file (with a co-located test); the reducer/hook in ../useNoragon.ts imports
// them from here. Tests import the individual files directly. Tuning constants
// live in ../constants.ts, not here.

export { xpToNext } from './xpToNext'
export { leveledProfile } from './leveledProfile'
export { statsAt } from './statsAt'
export { equippedDef } from './equippedDef'
export { deriveCombat } from './deriveCombat'
export { applyXp } from './applyXp'
export { resolveAttack } from './resolveAttack'
export { manhattan } from './manhattan'
export { nextRng } from './nextRng'
export { makeRng } from './makeRng'
export { makeRoller } from './makeRoller'

export { roomAt } from './roomAt'
export { tileAt } from './tileAt'
export { reveal } from './reveal'
export { blankSeen } from './blankSeen'
export { markLit } from './markLit'
export { computeVisible } from './computeVisible'
export { roomsByDoor } from './roomsByDoor'
export { chaseStep } from './chaseStep'
export { isActiveFoe } from './isActiveFoe'
export { activeEnemiesOf } from './activeEnemiesOf'
export { spawnEnemy } from './spawnEnemy'
export { runEnemyPhase } from './runEnemyPhase'
export { logLines } from './logLines'
export { generateDungeon } from './generateDungeon'

// The bestiary: the kinds of enemy the dungeon can hold and the flavor shown on
// their cards. Framework-free so the engine and the React layer can share it.

/** Every enemy kind the game knows about. The MVP only fields the bat. */
export type EnemyKind = 'bat'

/** Display info for an enemy kind — the name and blurb shown on its card. */
export interface EnemyInfo {
  name: string
  description: string
}

export const ENEMY_INFO: Record<EnemyKind, EnemyInfo> = {
  bat: {
    name: 'Bat',
    description:
      'A leathery cave-dweller that flits at intruders and nips for a single point of damage.',
  },
}

// Public API for embedding Legends of Noragon.
export { Noragon } from './components/Noragon'
export type { NoragonProps } from './components/Noragon'

export { useNoragon } from './game/useNoragon'
export type { NoragonApi, UseNoragonOptions } from './game/useNoragon'

export type {
  AttackKind,
  AttackProfile,
  AttackProfiles,
  Direction,
  Enemy,
  GameStatus,
  LogEntry,
  Point,
  Room,
  TileType,
} from './game/types'
export { ENEMY_INFO } from './game/enemies'
export type { EnemyInfo, EnemyKind } from './game/enemies'

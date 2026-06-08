// Public API for embedding Legends of Noragon.
export { Noragon } from './components/Noragon'
export type { NoragonProps } from './components/Noragon'

export { useNoragon } from './game/useNoragon'
export type { BoardView, HeroView, NoragonApi, RunView, UseNoragonOptions } from './game/useNoragon'

export type {
  AttackKind,
  AttackProfile,
  AttackProfiles,
  Direction,
  Enemy,
  Equipment,
  FloorItem,
  GameStatus,
  InventoryItem,
  LogEntry,
  Point,
  Room,
  TileType,
} from './game/types'
export { ENEMY_DEPTH_SCALING, ENEMY_INFO, enemyStatsAt } from './game/enemies'
export type { EnemyInfo, EnemyKind } from './game/enemies'
export { ITEMS } from './game/items'
export type { ItemCategory, ItemDef, ItemKind } from './game/items'

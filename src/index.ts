// Public API for embedding Legends of Noragon.
export { Noragon } from './components/Noragon'
export type { NoragonProps } from './components/Noragon'

// Building blocks — for keeping the look while arranging your own layout. Drive
// them from `useNoragon()` and wrap them in `NoragonRoot` (which carries the
// theme); see the README "Compose your own layout" section.
export { NoragonRoot } from './components/NoragonRoot'
export type { NoragonRootProps } from './components/NoragonRoot'
export { Board } from './components/Board'
export type { BoardProps } from './components/Board'
export { Stats } from './components/Stats'
export type { StatsProps } from './components/Stats'
export { EnemyCards } from './components/EnemyCards'
export type { EnemyCardsProps } from './components/EnemyCards'
export { ActivityLog } from './components/ActivityLog'
export type { ActivityLogProps } from './components/ActivityLog'
export { Inventory } from './components/Inventory'
export type { InventoryProps } from './components/Inventory'
export { Shop } from './components/Shop'
export type { ShopProps } from './components/Shop'
export { Overlay } from './components/Overlay'
export type { OverlayProps } from './components/Overlay'
export { useNoragonKeyboard } from './components/useNoragonKeyboard'
export type { UseNoragonKeyboardOptions } from './components/useNoragonKeyboard'

export { useNoragon } from './game/useNoragon'

export type {
  AttackKind,
  AttackProfile,
  AttackProfiles,
  BoardView,
  CombatFloat,
  Direction,
  Enemy,
  Equipment,
  FloorItem,
  GameStatus,
  HeroView,
  InventoryItem,
  LogEntry,
  NoragonApi,
  Point,
  Projectile,
  Room,
  ShopItem,
  RunView,
  TileType,
  UseNoragonOptions,
} from './game/types'
export { ENEMY_DEPTH_SCALING, ENEMY_INFO, enemyStatsAt } from './game/enemies'
export type { EnemyInfo, EnemyKind } from './game/enemies'
export { ITEMS } from './game/items'
export type { ItemCategory, ItemDef, ItemKind } from './game/items'

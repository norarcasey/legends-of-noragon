// Loot: the weapons, armor, and consumables the hero can carry and equip.
// Framework-free data so the engine and the React layer can share it.

export type ItemCategory = 'weapon' | 'armor' | 'potion'

export type ItemKind =
  | 'dagger'
  | 'shortSword'
  | 'longSword'
  | 'battleAxe'
  | 'clothes'
  | 'leather'
  | 'chainmail'
  | 'plate'
  | 'healthPotion'

/** Static definition of an item kind: how it reads and what it does. */
export interface ItemDef {
  name: string
  /** Glyph drawn when the item lies on the dungeon floor. */
  glyph: string
  category: ItemCategory
  /** Weapon: bonus added to the hero's min and max melee damage. */
  meleeDamage: number
  /** Weapon: bonus to melee accuracy (0–1; may be negative for heavy weapons). */
  meleeAccuracy: number
  /** Armor: flat damage subtracted from each hit the hero takes. */
  defense: number
  /** Potion: hit points restored when drunk. */
  heal: number
  /** Gold value, for display (and future shops). */
  value: number
}

const weapon = (
  name: string,
  meleeDamage: number,
  meleeAccuracy: number,
  value: number,
): ItemDef => ({
  name,
  glyph: '/',
  category: 'weapon',
  meleeDamage,
  meleeAccuracy,
  defense: 0,
  heal: 0,
  value,
})

const armor = (name: string, defense: number, value: number): ItemDef => ({
  name,
  glyph: ']',
  category: 'armor',
  meleeDamage: 0,
  meleeAccuracy: 0,
  defense,
  heal: 0,
  value,
})

export const ITEMS: Record<ItemKind, ItemDef> = {
  dagger: weapon('Dagger', 1, 0.05, 5),
  shortSword: weapon('Short Sword', 2, 0.05, 12),
  longSword: weapon('Long Sword', 3, 0.05, 22),
  battleAxe: weapon('Battle Axe', 5, -0.05, 35),
  clothes: armor("Traveler's Clothes", 1, 5),
  leather: armor('Leather Armor', 2, 14),
  chainmail: armor('Chainmail', 3, 28),
  plate: armor('Plate Armor', 5, 55),
  healthPotion: {
    name: 'Health Potion',
    glyph: '!',
    category: 'potion',
    meleeDamage: 0,
    meleeAccuracy: 0,
    defense: 0,
    heal: 10,
    value: 8,
  },
}

/** Gold the hero starts a fresh run with. */
export const STARTING_GOLD = 15

/** Weapons and armor that can be found as loot, weakest → strongest. */
export const WEAPON_KINDS: ItemKind[] = ['dagger', 'shortSword', 'longSword', 'battleAxe']
export const ARMOR_KINDS: ItemKind[] = ['clothes', 'leather', 'chainmail', 'plate']

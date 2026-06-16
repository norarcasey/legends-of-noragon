// Loot: the weapons, armor, and consumables the hero can carry and equip.
// Framework-free data so the engine and the React layer can share it.

export type ItemCategory = 'weapon' | 'armor' | 'ring' | 'amulet' | 'potion'

export type ItemKind =
  | 'dagger'
  | 'shortSword'
  | 'longSword'
  | 'battleAxe'
  | 'clothes'
  | 'leather'
  | 'chainmail'
  | 'plate'
  | 'ringOfProtection'
  | 'ringOfPower'
  | 'ringOfPrecision'
  | 'amuletOfHealth'
  | 'amuletOfValor'
  | 'healthPotion'

/** Static definition of an item kind: how it reads and what it does. */
export interface ItemDef {
  name: string
  category: ItemCategory
  /** Weapon: bonus added to the hero's min and max melee damage. */
  meleeDamage: number
  /** Weapon: bonus to melee accuracy (0–1; may be negative for heavy weapons). */
  meleeAccuracy: number
  /** Armor (and jewelry): flat damage subtracted from each hit the hero takes. */
  defense: number
  /** Jewelry: bonus added to the hero's maximum hit points while worn. */
  maxHp: number
  /** Potion: hit points restored when drunk. */
  heal: number
  /** Gold value, for display (and future shops). */
  value: number
  /** Whether identical copies collapse into one counted stack in the pack.
   *  Consumables stack; gear stays per-item so distinct pieces (and, later,
   *  same-kind pieces with different stats) remain individually equippable. */
  stackable: boolean
}

const weapon = (
  name: string,
  meleeDamage: number,
  meleeAccuracy: number,
  value: number,
): ItemDef => ({
  name,
  category: 'weapon',
  meleeDamage,
  meleeAccuracy,
  defense: 0,
  maxHp: 0,
  heal: 0,
  value,
  stackable: false,
})

const armor = (name: string, defense: number, value: number): ItemDef => ({
  name,
  category: 'armor',
  meleeDamage: 0,
  meleeAccuracy: 0,
  defense,
  maxHp: 0,
  heal: 0,
  value,
  stackable: false,
})

/** A ring or amulet: a small always-on boost while worn. One of each slot. */
const jewel = (
  name: string,
  category: 'ring' | 'amulet',
  bonus: Partial<Pick<ItemDef, 'meleeDamage' | 'meleeAccuracy' | 'defense' | 'maxHp'>>,
  value: number,
): ItemDef => ({
  name,
  category,
  meleeDamage: bonus.meleeDamage ?? 0,
  meleeAccuracy: bonus.meleeAccuracy ?? 0,
  defense: bonus.defense ?? 0,
  maxHp: bonus.maxHp ?? 0,
  heal: 0,
  value,
  stackable: false,
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
  ringOfProtection: jewel('Ring of Protection', 'ring', { defense: 1 }, 20),
  ringOfPower: jewel('Ring of Power', 'ring', { meleeDamage: 1 }, 20),
  ringOfPrecision: jewel('Ring of Precision', 'ring', { meleeAccuracy: 0.05 }, 20),
  amuletOfHealth: jewel('Amulet of Health', 'amulet', { maxHp: 5 }, 32),
  amuletOfValor: jewel('Amulet of Valor', 'amulet', { meleeDamage: 1, meleeAccuracy: 0.05 }, 40),
  healthPotion: {
    name: 'Health Potion',
    category: 'potion',
    meleeDamage: 0,
    meleeAccuracy: 0,
    defense: 0,
    maxHp: 0,
    heal: 10,
    value: 8,
    stackable: true,
  },
}

/** Gold the hero starts a fresh run with. */
export const STARTING_GOLD = 15

/** Item kinds that can be found as loot, by slot — weapons/armor weakest →
 *  strongest; rings and amulets are flavor boosts, picked at random. */
export const WEAPON_KINDS: ItemKind[] = ['dagger', 'shortSword', 'longSword', 'battleAxe']
export const ARMOR_KINDS: ItemKind[] = ['clothes', 'leather', 'chainmail', 'plate']
export const RING_KINDS: ItemKind[] = ['ringOfProtection', 'ringOfPower', 'ringOfPrecision']
export const AMULET_KINDS: ItemKind[] = ['amuletOfHealth', 'amuletOfValor']

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const signedPct = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`

/** A short, human-readable summary of what an item does when worn or used —
 *  e.g. `+2 damage · +5% accuracy`, `+1 defense`, `restores 10 HP`. For tooltips. */
export function itemEffect(kind: ItemKind): string {
  const d = ITEMS[kind]
  const parts: string[] = []
  if (d.meleeDamage) parts.push(`${signed(d.meleeDamage)} damage`)
  if (d.meleeAccuracy) parts.push(`${signedPct(d.meleeAccuracy)} accuracy`)
  if (d.defense) parts.push(`${signed(d.defense)} defense`)
  if (d.maxHp) parts.push(`${signed(d.maxHp)} max HP`)
  if (d.heal) parts.push(`restores ${d.heal} HP`)
  return parts.length > 0 ? parts.join(' · ') : 'no effect'
}

import { ITEMS } from '../game/items'
import type { ItemKind } from '../game/items'
import './ItemIcon.css'

export interface ItemIconProps {
  /** The item to draw an icon for. */
  kind: ItemKind
  /** Extra class on the `<svg>`. */
  className?: string
}

const STEEL = '#c6ccd8'
const GOLD = '#e6c34a'
const WOOD = '#7a4f28'
const GEM = '#7ec8e3'

/** A melee weapon, point-up; the shape varies by kind. */
function weaponIcon(kind: ItemKind) {
  if (kind === 'battleAxe') {
    return (
      <>
        <rect x="11" y="3" width="2" height="18" rx="0.8" fill={WOOD} />
        <path d="M13 4 C20 5 21 11 13 12 Z" fill={STEEL} />
        <path d="M11 4 C4 5 3 11 11 12 Z" fill={STEEL} />
        <circle cx="12" cy="21" r="1.4" fill={WOOD} />
      </>
    )
  }
  if (kind === 'dagger') {
    return (
      <>
        <path d="M12 5 L14.5 9 L14.5 14 L9.5 14 L9.5 9 Z" fill={STEEL} />
        <rect x="7.5" y="14" width="9" height="2.2" rx="1" fill={GOLD} />
        <rect x="11" y="16" width="2" height="3.5" fill={WOOD} />
        <circle cx="12" cy="20.4" r="1.3" fill={GOLD} />
      </>
    )
  }
  // Sword family (short / long).
  return (
    <>
      <path d="M12 2 L15 8 L15 14 L9 14 L9 8 Z" fill={STEEL} />
      <rect x="6" y="14" width="12" height="2.4" rx="1" fill={GOLD} />
      <rect x="11" y="16.4" width="2" height="4" fill={WOOD} />
      <circle cx="12" cy="21" r="1.6" fill={GOLD} />
    </>
  )
}

/** A band with a gem — all rings share it. */
function ringIcon() {
  return (
    <>
      <circle cx="12" cy="14.5" r="6.3" fill="none" stroke={GOLD} strokeWidth="2.4" />
      <path d="M12 4 L15 7.5 L12 11 L9 7.5 Z" fill={GEM} />
    </>
  )
}

/**
 * A small SVG icon for an item — used in the pack's equipment slots. Weapons
 * draw by kind (sword / dagger / axe), rings as a gemmed band. Other categories
 * fall back to a simple mark. Decorative (the slot's label names the item).
 */
export function ItemIcon({ kind, className }: ItemIconProps) {
  const category = ITEMS[kind].category
  let body
  if (category === 'weapon') body = weaponIcon(kind)
  else if (category === 'ring') body = ringIcon()
  else body = <circle cx="12" cy="12" r="4" fill={GOLD} />

  return (
    <svg
      className={`noragon__item-icon${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      stroke="#23232b"
      strokeWidth="0.6"
      strokeLinejoin="round"
      aria-hidden
    >
      {body}
    </svg>
  )
}

export default ItemIcon

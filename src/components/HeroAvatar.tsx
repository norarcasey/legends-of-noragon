import type { ItemKind } from '../game/items'
import './HeroAvatar.css'

export interface HeroAvatarProps {
  /** Equipped armor kind, or null. Tints the torso (and adds pauldrons if heavy). */
  armor?: ItemKind | null
  /** Equipped amulet kind, or null. A pendant on the chest. */
  amulet?: ItemKind | null
}

// A small fixed palette for the figure; equipment colours come from the maps
// below. (Mid-tones so the doll reads on both the dark and parchment cards.)
const SKIN = '#d8b08c'
const BODY = '#5b6473'
const GOLD = '#e6c34a'

/** Torso tint per armor kind. */
const ARMOR_FILL: Partial<Record<ItemKind, string>> = {
  clothes: '#9c7a4a',
  leather: '#7a4f28',
  chainmail: '#8a93a6',
  plate: '#bfc6d2',
}
/** Heavier armor also gets shoulder pauldrons. */
const HEAVY_ARMOR = new Set<ItemKind>(['chainmail', 'plate'])

/**
 * A simple SVG paper-doll of the hero. Worn-on-the-body gear updates with what's
 * equipped — armor tints (and bulks) the torso, an amulet hangs at the chest.
 * Held/handheld gear (weapon, ring) lives in slots beside the doll, not here.
 * Drawn layer-by-layer over a base body, so future on-body slots (helmet, boots,
 * cape, bracers, …) are just more layers.
 */
export function HeroAvatar({ armor = null, amulet = null }: HeroAvatarProps) {
  const armorFill = armor ? (ARMOR_FILL[armor] ?? BODY) : null
  const heavy = armor != null && HEAVY_ARMOR.has(armor)

  return (
    <svg
      className="noragon__avatar"
      viewBox="0 0 72 108"
      role="img"
      aria-label="Your hero"
      stroke="#23232b"
      strokeWidth={1}
      strokeLinejoin="round"
    >
      {/* ---- Base body ---- */}
      <rect x="26" y="62" width="9" height="38" rx="2.5" fill={BODY} />
      <rect x="37" y="62" width="9" height="38" rx="2.5" fill={BODY} />
      <rect x="15" y="31" width="8" height="32" rx="4" fill={BODY} />
      <rect x="49" y="31" width="8" height="32" rx="4" fill={BODY} />
      <path d="M23 29 H49 L46 64 H26 Z" fill={BODY} />
      <circle cx="19" cy="64" r="4.5" fill={SKIN} />
      <circle cx="53" cy="64" r="4.5" fill={SKIN} />
      <rect x="32" y="22" width="8" height="6" fill={SKIN} />
      <circle cx="36" cy="15" r="10" fill={SKIN} />

      {/* ---- On-body equipment layers ---- */}
      {armorFill && (
        <g data-testid="avatar-armor">
          <path d="M22 28 H50 L47 65 H25 Z" fill={armorFill} />
          {heavy && (
            <>
              <circle cx="23" cy="30" r="6" fill={armorFill} />
              <circle cx="49" cy="30" r="6" fill={armorFill} />
            </>
          )}
        </g>
      )}
      {amulet && (
        <g data-testid="avatar-amulet">
          <path d="M30 28 L36 40 L42 28" fill="none" stroke={GOLD} />
          <circle cx="36" cy="42" r="2.6" fill={GOLD} />
        </g>
      )}
    </svg>
  )
}

export default HeroAvatar

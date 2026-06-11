import type { ItemKind } from '../game/items'
import './HeroAvatar.css'

export interface HeroAvatarProps {
  /** Equipped weapon kind, or null. Drawn in the hero's right hand. */
  weapon?: ItemKind | null
  /** Equipped armor kind, or null. Tints the torso (and adds pauldrons if heavy). */
  armor?: ItemKind | null
  /** Equipped ring kind, or null. A band on the left hand. */
  ring?: ItemKind | null
  /** Equipped amulet kind, or null. A pendant on the chest. */
  amulet?: ItemKind | null
}

// A small fixed palette for the figure; equipment colours come from the maps
// below. (Mid-tones so the doll reads on both the dark and parchment cards.)
const SKIN = '#d8b08c'
const BODY = '#5b6473'
const STEEL = '#c6ccd8'
const WOOD = '#7a4f28'
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

/** A melee weapon held in the right hand (centred near 53,64), pointing up. */
function Weapon({ kind }: { kind: ItemKind }) {
  if (kind === 'battleAxe') {
    return (
      <g data-testid="avatar-weapon">
        <rect x="51.5" y="34" width="3" height="32" rx="1" fill={WOOD} />
        <path d="M54 35 C65 37 66 48 54 51 Z" fill={STEEL} />
      </g>
    )
  }
  // Sword family + dagger: a blade with a crossguard and pommel; length by tier.
  const len = kind === 'dagger' ? 16 : kind === 'longSword' ? 32 : 24
  return (
    <g data-testid="avatar-weapon">
      <rect x="51.5" y={64 - len} width="3" height={len} rx="1.2" fill={STEEL} />
      <rect x="47" y="61" width="12" height="2.6" rx="1" fill={GOLD} />
      <circle cx="53" cy="67" r="2" fill={GOLD} />
    </g>
  )
}

/**
 * A simple SVG paper-doll of the hero whose gear updates with what's equipped —
 * armor tints (and bulks) the torso, a weapon fills the hand, a ring bands the
 * other hand, an amulet hangs at the chest. Built layer-by-layer so future slots
 * (helmet, boots, cape, bracers, …) are just more layers.
 */
export function HeroAvatar({
  weapon = null,
  armor = null,
  ring = null,
  amulet = null,
}: HeroAvatarProps) {
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

      {/* ---- Equipment layers ---- */}
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
      {weapon && <Weapon kind={weapon} />}
      {ring && <circle cx="19" cy="64" r="1.8" fill={GOLD} data-testid="avatar-ring" />}
    </svg>
  )
}

export default HeroAvatar

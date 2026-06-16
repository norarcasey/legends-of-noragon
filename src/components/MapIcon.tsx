import './Icon.css'

/** The board features that draw an icon (everything but plain floor/wall). */
export type MapIconKind =
  | 'chest'
  | 'stairs'
  | 'rubble'
  | 'merchant'
  | 'trap'
  | 'loot'
  | 'player'
  | 'arrow'

export interface MapIconProps {
  kind: MapIconKind
  className?: string
}

/**
 * Flat icons for the things drawn on the dungeon grid — chest, stairs, rubble,
 * the merchant's scales, a trap, a loot satchel, the hero, and a flying arrow.
 * All `currentColor` so each tile's colour token (`--noragon-<feature>`) and
 * responsive `em` sizing flow straight through, exactly as the old glyphs did.
 */
function body(kind: MapIconKind) {
  switch (kind) {
    case 'chest':
      return (
        <>
          <path d="M4 9a8 5 0 0 1 16 0v1H4Z" />
          <rect x="4" y="10" width="16" height="8" rx="1" />
          <rect x="10.6" y="9" width="2.8" height="5" rx="0.6" fill="#10101a" />
          <circle cx="12" cy="11.6" r="0.7" fill="currentColor" />
        </>
      )
    case 'stairs':
      return (
        <>
          <path d="M5 18h4v-3h4v-3h4V9h-4v3h-4v3H5Z" />
        </>
      )
    case 'rubble':
      return (
        <>
          <path d="M3 18l3-5 3 5Zm6 0l4-7 4 7Zm9 0l2-4 2 4Z" />
        </>
      )
    case 'merchant':
      return (
        <>
          <rect x="11.4" y="4" width="1.2" height="15" rx="0.6" />
          <rect x="6" y="18" width="12" height="1.4" rx="0.7" />
          <path d="M5 7h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M5 7 2.5 12a3 3 0 0 0 5 0Z" />
          <path d="M19 7l2.5 5a3 3 0 0 1-5 0Z" />
        </>
      )
    case 'trap':
      return (
        <>
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M12 3l1.6 4.2L12 9l-1.6-1.8ZM12 21l-1.6-4.2L12 15l1.6 1.8ZM3 12l4.2-1.6L9 12l-1.8 1.6ZM21 12l-4.2 1.6L15 12l1.8-1.6Z" />
        </>
      )
    case 'loot':
      return (
        <>
          <path d="M8 8h8l2 4v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-5Z" />
          <path
            d="M9 8c0-2 1.5-3 3-3s3 1 3 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path d="M6 12h12" stroke="#10101a" strokeWidth="1" />
        </>
      )
    case 'player':
      return (
        <>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5 20c0-4 3-7 7-7s7 3 7 7Z" />
        </>
      )
    case 'arrow':
      // Points east (0°); the board rotates it toward its target.
      return (
        <>
          <path d="M3 12h13M16 9l5 3-5 3ZM3 12l3-2v4Z" />
        </>
      )
  }
}

export function MapIcon({ kind, className }: MapIconProps) {
  return (
    <svg
      className={`noragon__sprite${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      {body(kind)}
    </svg>
  )
}

export default MapIcon

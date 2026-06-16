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
      // A bear trap, jaws open: two semicircular rows of teeth, round springs to
      // each side, and a trigger plate at the centre.
      return (
        <>
          {/* Upper jaw — outer arc, teeth pointing down toward the mouth. */}
          <path d="M4.8 9.2A7.6 7.4 0 0 1 19.2 9.2L17.8 10.6 16.6 9.2 15.4 10.6 14.2 9.2 13 10.6 11.8 9.2 10.6 10.6 9.4 9.2 8.2 10.6 7 9.2 5.8 10.6Z" />
          {/* Lower jaw — mirror. */}
          <path d="M4.8 14.8A7.6 7.4 0 0 0 19.2 14.8L17.8 13.4 16.6 14.8 15.4 13.4 14.2 14.8 13 13.4 11.8 14.8 10.6 13.4 9.4 14.8 8.2 13.4 7 14.8 5.8 13.4Z" />
          {/* Side springs and the centre trigger plate. */}
          <circle cx="3.6" cy="12" r="2" />
          <circle cx="20.4" cy="12" r="2" />
          <circle cx="3.6" cy="12" r="0.7" fill="#10101a" />
          <circle cx="20.4" cy="12" r="0.7" fill="#10101a" />
          <circle cx="12" cy="12" r="1" fill="#10101a" />
        </>
      )
    case 'loot':
      // A mystery loot box, à la a "?" block: a rounded block with corner
      // rivets and a bold question mark — its contents stay a surprise.
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
          <g fill="#10101a">
            <circle cx="6.7" cy="6.7" r="0.85" />
            <circle cx="17.3" cy="6.7" r="0.85" />
            <circle cx="6.7" cy="17.3" r="0.85" />
            <circle cx="17.3" cy="17.3" r="0.85" />
          </g>
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx="2.5"
            fill="none"
            stroke="#10101a"
            strokeWidth="1.1"
          />
          <path
            d="M9.4 9.6C9.4 6.8 14.6 6.8 14.6 9.8 14.6 11.6 12 11.6 12 13.6"
            fill="none"
            stroke="#10101a"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="16" r="1.05" fill="#10101a" />
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

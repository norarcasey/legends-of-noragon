import type { EnemyKind } from '../game/enemies'
import './Icon.css'

export interface EnemyIconProps {
  /** The creature to draw. */
  kind: EnemyKind
  /** Extra class on the `<svg>`. */
  className?: string
}

/**
 * A flat, single-colour silhouette for each enemy kind, drawn with
 * `currentColor` so the board's per-kind colour token (`--noragon-<kind>`) and
 * responsive `em` sizing carry straight through. Decorative — the card and the
 * activity log name the creature.
 */
function body(kind: EnemyKind) {
  switch (kind) {
    case 'bat':
      // Traditional bat: head + ears in the centre, scalloped wings to each side.
      return (
        <>
          {/* Left wing — top edge sweeps out to the tip, scalloped membrane back. */}
          <path d="M11.6 8.5C8 7 5 6.4 1.5 6.6C2.5 8.6 3 9.2 3.8 10.6C4.4 9.5 5 9.3 5.6 9.9C6.2 11.3 6.8 11.7 7.5 12.3C8.1 10.9 8.7 10.7 9.3 11.1C9.9 12.1 10.4 12.5 11 12.9C11.2 11.1 11.4 9.8 11.6 8.5Z" />
          {/* Right wing — mirror of the left. */}
          <path d="M12.4 8.5C16 7 19 6.4 22.5 6.6C21.5 8.6 21 9.2 20.2 10.6C19.6 9.5 19 9.3 18.4 9.9C17.8 11.3 17.2 11.7 16.5 12.3C15.9 10.9 15.3 10.7 14.7 11.1C14.1 12.1 13.6 12.5 13 12.9C12.8 11.1 12.6 9.8 12.4 8.5Z" />
          {/* Ears, head, body, and two little eyes — facing forward. */}
          <path d="M10 6 9.3 3 11.4 5.8ZM14 6l.7-3-2.1 2.8Z" />
          <circle cx="12" cy="8" r="2.6" />
          <ellipse cx="12" cy="12" rx="2" ry="3.4" />
          <circle cx="11" cy="7.7" r="0.55" fill="#10101a" />
          <circle cx="13" cy="7.7" r="0.55" fill="#10101a" />
        </>
      )
    case 'kobold':
      return (
        <>
          <path d="M9 5 6 8l3 1Zm6 0 3 3-3 1Z" />
          <circle cx="12" cy="9" r="3.4" />
          <path d="M9 13h6l1 6H8Z" />
          <rect x="16" y="4" width="1.2" height="13" rx="0.6" />
        </>
      )
    case 'spider':
      return (
        <>
          <g stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round">
            <path d="M9 12 3 8M9 14l-6 2M15 12l6-4M15 14l6 2M10 10 6 6M14 10l4-4" />
          </g>
          <circle cx="12" cy="13.5" r="4" />
          <circle cx="12" cy="8.5" r="2.4" />
        </>
      )
    case 'direWolf':
      return (
        <>
          <path d="M4 7l3 2 2-2 1 3h4l1-3 2 2 3-2-1 6c0 4-3 6-7 6s-7-2-7-6Z" />
          <circle cx="9.5" cy="12" r="0.9" fill="#10101a" />
          <circle cx="14.5" cy="12" r="0.9" fill="#10101a" />
        </>
      )
    case 'skeleton':
      return (
        <>
          <path d="M12 4a6 6 0 0 0-6 6c0 2 1 3 2 4v3h8v-3c1-1 2-2 2-4a6 6 0 0 0-6-6Z" />
          <circle cx="9.5" cy="10" r="1.5" fill="#10101a" />
          <circle cx="14.5" cy="10" r="1.5" fill="#10101a" />
          <path d="M11 13h2v3h-2Z" fill="#10101a" />
        </>
      )
    case 'goblin':
      return (
        <>
          <path d="M5 7l3 3-3 2Zm14 0-3 3 3 2Z" />
          <path d="M12 6a6 6 0 0 0-6 6c0 4 3 6 6 6s6-2 6-6a6 6 0 0 0-6-6Z" />
          <circle cx="9.5" cy="11" r="1.1" fill="#10101a" />
          <circle cx="14.5" cy="11" r="1.1" fill="#10101a" />
          <path d="M9 15h6l-1.5 1.5h-3Z" fill="#10101a" />
        </>
      )
    case 'orc':
      return (
        <>
          <path d="M12 5a6 6 0 0 0-6 6c0 4 3 7 6 7s6-3 6-7a6 6 0 0 0-6-6Z" />
          <circle cx="9.5" cy="10.5" r="1.1" fill="#10101a" />
          <circle cx="14.5" cy="10.5" r="1.1" fill="#10101a" />
          <path d="M9.5 14l1 3 1-2 1 2 1-3Z" fill="#10101a" />
        </>
      )
    case 'ogre':
      return (
        <>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M6 13h12l1 8H5Z" />
          <circle cx="10.6" cy="7.6" r="0.9" fill="#10101a" />
          <circle cx="13.4" cy="7.6" r="0.9" fill="#10101a" />
        </>
      )
    case 'troll':
      return (
        <>
          <path
            d="M7 4l1.5 3M17 4l-1.5 3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="12" cy="9" r="4" />
          <path d="M6 14h12l1 7H5Z" />
          <circle cx="10.3" cy="8.6" r="1" fill="#10101a" />
          <circle cx="13.7" cy="8.6" r="1" fill="#10101a" />
        </>
      )
    case 'wraith':
      return (
        <>
          <path d="M12 3c-4 0-6 3-6 7v10l2-2 2 2 2-2 2 2 2-2V10c0-4-2-7-6-7Z" />
          <ellipse cx="9.8" cy="10" rx="1.1" ry="1.6" fill="#10101a" />
          <ellipse cx="14.2" cy="10" rx="1.1" ry="1.6" fill="#10101a" />
        </>
      )
  }
}

export function EnemyIcon({ kind, className }: EnemyIconProps) {
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

export default EnemyIcon

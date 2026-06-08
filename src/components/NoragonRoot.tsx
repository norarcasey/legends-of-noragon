import type { ReactNode } from 'react'
import './Noragon.css'

export interface NoragonRootProps {
  children: ReactNode
  /** Extra class on the root element. */
  className?: string
  /** Accessible label for the container. */
  ariaLabel?: string
}

/**
 * The themed container for Noragon UI. It carries the `.noragon` class that
 * defines the colour custom properties and base styles every part
 * (`Board`, `Stats`, `EnemyCards`, `ActivityLog`, `Inventory`) reads from — so
 * when composing your own layout from those parts, wrap them in this (and import
 * the stylesheet). The all-in-one `Noragon` component renders one internally.
 */
export function NoragonRoot({ children, className, ariaLabel }: NoragonRootProps) {
  return (
    <section className={`noragon${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
      {children}
    </section>
  )
}

export default NoragonRoot

import { useEffect, useRef } from 'react'
import type { LogEntry } from '../game/types'
import { splitLog } from './logHighlights'
import './ActivityLog.css'

export interface ActivityLogProps {
  /** The log lines (`game.log`), oldest first; nothing renders when empty. */
  entries: LogEntry[]
}

/**
 * A scrolling, turn-by-turn record of what happened — moves, strikes, bites,
 * room discoveries, and the run's end. Newest line sits at the bottom and the
 * panel keeps itself scrolled there as entries arrive.
 */
export function ActivityLog({ entries }: ActivityLogProps) {
  const scrollRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length])

  if (entries.length === 0) return null

  return (
    <div className="noragon__log" data-testid="activity-log">
      <h3 className="noragon__log-title">Activity</h3>
      <ol className="noragon__log-list" ref={scrollRef} role="log" aria-label="Activity log">
        {entries.map((entry) => (
          <li key={entry.id} className="noragon__log-entry" data-testid="log-entry">
            {splitLog(entry.text).map((seg, i) =>
              seg.tone ? (
                <span key={i} className={`noragon__log-mark noragon__log-mark--${seg.tone}`}>
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

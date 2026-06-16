import { useCallback, useEffect, useState } from 'react'

/** Selectable zoom levels — how many tiles span the board. Smaller = more zoomed
 *  in (bigger tiles, less of the level visible). */
export const ZOOM_PRESETS = [7, 9, 11, 13, 15]
const DEFAULT_ZOOM = 11
const STORAGE_KEY = 'noragon:zoom'

const nearestPreset = (n: number): number =>
  ZOOM_PRESETS.reduce(
    (best, p) => (Math.abs(p - n) < Math.abs(best - n) ? p : best),
    ZOOM_PRESETS[0],
  )

function storedZoom(fallback: number): number {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const n = raw == null ? NaN : Number(raw)
    return Number.isFinite(n) ? nearestPreset(n) : fallback
  } catch {
    return fallback
  }
}

export interface Zoom {
  /** Tiles visible across the board (drives `--noragon-visible`). */
  visible: number
  /** Zoom in one step (fewer tiles); no-op at the closest preset. */
  zoomIn: () => void
  /** Zoom out one step (more tiles); no-op at the farthest preset. */
  zoomOut: () => void
  /** Whether another step in is available (for disabling the control). */
  canZoomIn: boolean
  /** Whether another step out is available. */
  canZoomOut: boolean
}

/**
 * View-state for the board's zoom: a tile-count stepped through {@link ZOOM_PRESETS}
 * and remembered in `localStorage`, so the player's choice sticks between runs.
 * Purely presentational — the game engine never sees it. `initial` (e.g. a
 * `<Noragon zoom>` prop) is used only when nothing is stored yet.
 */
export function useZoom(initial: number = DEFAULT_ZOOM): Zoom {
  const [visible, setVisible] = useState(() => storedZoom(nearestPreset(initial)))

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, String(visible))
    } catch {
      // Storage unavailable (private mode, etc.) — zoom just won't persist.
    }
  }, [visible])

  const step = useCallback((dir: number) => {
    setVisible((v) => {
      const i = ZOOM_PRESETS.indexOf(nearestPreset(v))
      const j = Math.min(ZOOM_PRESETS.length - 1, Math.max(0, i + dir))
      return ZOOM_PRESETS[j]
    })
  }, [])

  const i = ZOOM_PRESETS.indexOf(nearestPreset(visible))
  return {
    visible,
    zoomIn: useCallback(() => step(-1), [step]),
    zoomOut: useCallback(() => step(1), [step]),
    canZoomIn: i > 0,
    canZoomOut: i < ZOOM_PRESETS.length - 1,
  }
}

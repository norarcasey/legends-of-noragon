import { useEffect } from 'react'
import type { Direction, NoragonApi } from '../game/types'

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

export interface UseNoragonKeyboardOptions {
  /** Listen for keys. Default `true`; pass `false` to disable without unmounting. */
  enabled?: boolean
}

/**
 * Wire the default keyboard controls to a {@link NoragonApi} from `useNoragon()`:
 * arrow keys / WASD move (and start a stopped run on the first step), Enter
 * begins/restarts, `F` toggles aim on/off (while aiming, Enter fires, Tab/arrows
 * switch targets, Esc cancels), `>`/Enter descends on the stairs, `Q` quaffs
 * a health potion, and `E` attempts to disarm an adjacent trap.
 *
 * Attaches a single `window` keydown listener. `<Noragon />` uses this; call it
 * yourself when composing your own layout from the exported parts.
 */
export function useNoragonKeyboard(
  game: NoragonApi,
  options: UseNoragonKeyboardOptions = {},
): void {
  const enabled = options.enabled ?? true
  const { aiming, shopping, start, move, descend, drink, aimStart, aimCycle, aimCancel, fire } =
    game
  const { closeShop, disarm, adjacentTrap } = game
  const { status } = game.run
  const { onStairs } = game.hero
  const firstPotion = game.hero.inventory.find((i) => i.kind === 'healthPotion')

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      // ---- Shopping: the overlay owns the screen. Esc leaves; buying and
      // selling are click-only, and every other key is swallowed. ----
      if (shopping) {
        if (e.key === 'Escape') {
          e.preventDefault()
          closeShop()
        }
        return
      }

      // ---- Aiming mode: arrows cycle targets, Enter fires, F/Esc cancel. F is
      // a toggle — the same key that entered aiming leaves it, for free. ----
      if (aiming) {
        if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') {
          e.preventDefault()
          aimCancel()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          fire()
        } else if (e.key === 'Tab') {
          e.preventDefault()
          aimCycle(e.shiftKey ? -1 : 1)
        } else {
          const dir = KEY_TO_DIRECTION[e.key]
          if (!dir) return
          e.preventDefault()
          aimCycle(dir === 'up' || dir === 'left' ? -1 : 1)
        }
        return
      }

      // From a stopped dungeon (idle or after death), Enter begins a fresh run —
      // the same as clicking the Enter / Delve again button.
      if (status !== 'playing' && e.key === 'Enter') {
        e.preventDefault()
        start()
        return
      }

      // ---- Normal play ----
      if (status === 'playing' && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        aimStart()
        return
      }
      // Descend the stairs deliberately with `>` (or Enter while on them).
      if (status === 'playing' && onStairs && (e.key === '>' || e.key === 'Enter')) {
        e.preventDefault()
        descend()
        return
      }
      // Quick-drink a health potion with Q.
      if (status === 'playing' && (e.key === 'q' || e.key === 'Q') && firstPotion) {
        e.preventDefault()
        drink(firstPotion.id)
        return
      }
      // Attempt to disarm an adjacent trap with E (auto-targets the neighbour).
      if (status === 'playing' && (e.key === 'e' || e.key === 'E') && adjacentTrap) {
        e.preventDefault()
        disarm(adjacentTrap)
        return
      }

      const dir = KEY_TO_DIRECTION[e.key]
      if (!dir) return
      e.preventDefault()
      // A direction key from a stopped dungeon both begins and takes the first step.
      if (status === 'playing') {
        move(dir)
      } else if (status === 'idle') {
        start()
        move(dir)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    enabled,
    status,
    aiming,
    shopping,
    onStairs,
    firstPotion,
    adjacentTrap,
    start,
    move,
    descend,
    drink,
    disarm,
    aimStart,
    aimCycle,
    aimCancel,
    fire,
    closeShop,
  ])
}

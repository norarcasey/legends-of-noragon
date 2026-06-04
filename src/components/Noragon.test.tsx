import { StrictMode } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Noragon } from './Noragon'
import { useNoragon } from '../game/useNoragon'
import type { NoragonApi } from '../game/useNoragon'
import type { Direction, Point } from '../game/types'

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

// Pick a legal (non-wall) step that heads toward `target`, closing the larger
// gap first. Used to drive the hero deterministically without hand-listing moves.
function stepToward(state: NoragonApi, target: Point): Direction {
  const { player, tiles } = state
  const dx = target.x - player.x
  const dy = target.y - player.y
  const horiz: Direction | null = dx > 0 ? 'right' : dx < 0 ? 'left' : null
  const vert: Direction | null = dy > 0 ? 'down' : dy < 0 ? 'up' : null
  const preferred = Math.abs(dx) >= Math.abs(dy) ? [horiz, vert] : [vert, horiz]
  const order: Direction[] = []
  for (const d of [...preferred, 'up', 'down', 'left', 'right'] as const) {
    if (d && !order.includes(d)) order.push(d)
  }
  for (const d of order) {
    const tx = player.x + DELTA[d].x
    const ty = player.y + DELTA[d].y
    if (tiles[ty]?.[tx] && tiles[ty][tx] !== 'wall') return d
  }
  return 'right'
}

describe('<Noragon />', () => {
  it('renders the title, the hero stats, and the idle overlay by default', () => {
    render(<Noragon />)
    expect(screen.getByRole('heading', { name: 'Legends of Noragon' })).toBeInTheDocument()
    expect(screen.getByText('6/6')).toBeInTheDocument() // HP
    expect(screen.getByText('Descend into the dungeon of Noragon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter' })).toBeInTheDocument()
  })

  it('hides the title when title is null', () => {
    render(<Noragon title={null} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('starts on the first direction key and renders the hero', () => {
    render(<Noragon />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.queryByText('Descend into the dungeon of Noragon')).not.toBeInTheDocument()
    expect(screen.getByTestId('player')).toBeInTheDocument()
  })

  it('keeps a room and its bats hidden until the hero enters it', () => {
    render(<Noragon />)
    fireEvent.keyDown(window, { key: 'ArrowRight' }) // start + step into the entry hall
    // The bats live in the next room, still in the dark.
    expect(screen.queryAllByTestId('bat')).toHaveLength(0)

    // Press east until the hero crosses into the bats' room.
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getAllByTestId('bat')).toHaveLength(2)
  })

  it('shows enemy cards only once the hero shares a room with active enemies', () => {
    render(<Noragon />)
    fireEvent.keyDown(window, { key: 'ArrowRight' }) // start in the empty entry hall
    expect(screen.queryAllByTestId('enemy-card')).toHaveLength(0)

    // Walk into the bats' room — two cards, named and with a health readout.
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: 'ArrowRight' })
    const cards = screen.getAllByTestId('enemy-card')
    expect(cards).toHaveLength(2)
    expect(screen.getAllByText('Bat')).toHaveLength(2)
    expect(screen.getAllByText('1/1')).toHaveLength(2)
  })

  it('records each turn in the activity log', () => {
    render(<Noragon />)
    fireEvent.keyDown(window, { key: 'ArrowRight' }) // start + first step east
    const log = screen.getByTestId('activity-log')
    expect(log).toHaveTextContent('You descend into the dungeon of Noragon.')
    expect(log).toHaveTextContent('You enter the entry hall.')
    expect(log).toHaveTextContent('You move east.')
  })
})

describe('useNoragon', () => {
  it('one-shots both bats when the hero bumps them (StrictMode)', () => {
    // StrictMode double-invokes the reducer; a pure reducer must survive it.
    const { result } = renderHook(() => useNoragon({ maxHp: 99 }), { wrapper: StrictMode })
    act(() => result.current.start())
    expect(result.current.enemies).toHaveLength(2)

    // Hunt the nearest bat each turn, bumping it to attack once adjacent.
    for (let i = 0; i < 200 && result.current.enemies.length > 0; i++) {
      const target = result.current.enemies[0]
      const dir = stepToward(result.current, target)
      act(() => result.current.move(dir))
    }

    expect(result.current.kills).toBe(2)
    expect(result.current.enemies).toHaveLength(0)
    expect(result.current.status).toBe('playing')
  })

  it('completes the level when the hero reaches the chest', () => {
    const { result } = renderHook(() => useNoragon())
    act(() => result.current.start())

    // A straight rush east along the door row reaches the chest at (15, 3); the
    // bats trail diagonally and never land a hit on this path.
    for (let i = 0; i < 14 && result.current.status === 'playing'; i++) {
      act(() => result.current.move('right'))
    }

    expect(result.current.status).toBe('won')
    expect(result.current.hp).toBe(result.current.maxHp)
    expect(result.current.kills).toBe(0)
  })

  it('kills the hero when bats whittle its hit points to zero', () => {
    const { result } = renderHook(() => useNoragon({ maxHp: 1 }))
    act(() => result.current.start())

    // Walk into the bats' room and let them sandwich the hero, then bump one —
    // the other lands the killing blow during the same enemy phase.
    const moves: Direction[] = ['right', 'right', 'right', 'right', 'right', 'right', 'right', 'up']
    for (const dir of moves) {
      act(() => result.current.move(dir))
    }

    expect(result.current.status).toBe('dead')
    expect(result.current.hp).toBe(0)
  })

  it('reveals rooms through fog only as the hero enters them', () => {
    const { result } = renderHook(() => useNoragon())
    act(() => result.current.start())

    // Start room (around the hero) is lit; the bats' room and the vault are dark.
    expect(result.current.visible[3][1]).toBe(true) // hero start tile
    expect(result.current.visible[2][8]).toBe(false) // a bat in the next room
    expect(result.current.visible[3][15]).toBe(false) // the chest, two rooms over
    expect(result.current.revealedRooms).toEqual([0])

    // Walk east into the bats' room.
    for (let i = 0; i < 6 && result.current.currentRoom !== 1; i++) {
      act(() => result.current.move('right'))
    }

    expect(result.current.revealedRooms).toContain(1)
    expect(result.current.visible[2][8]).toBe(true) // the bats' room is now lit
    expect(result.current.visible[3][15]).toBe(false) // the vault is still dark
  })

  it('marks enemies active only while the hero shares their room', () => {
    const { result } = renderHook(() => useNoragon())
    act(() => result.current.start())
    expect(result.current.activeEnemies).toHaveLength(0) // empty entry hall

    for (let i = 0; i < 6 && result.current.currentRoom !== 1; i++) {
      act(() => result.current.move('right'))
    }

    expect(result.current.currentRoom).toBe(1)
    expect(result.current.activeEnemies).toHaveLength(2)
    expect(result.current.activeEnemies.every((e) => e.kind === 'bat')).toBe(true)
  })

  it('narrates moves, room discoveries, and strikes in the activity log', () => {
    const { result } = renderHook(() => useNoragon({ maxHp: 99 }), { wrapper: StrictMode })
    act(() => result.current.start())
    expect(result.current.log.map((e) => e.text)).toContain('You enter the entry hall.')

    for (let i = 0; i < 200 && result.current.enemies.length > 0; i++) {
      const dir = stepToward(result.current, result.current.enemies[0])
      act(() => result.current.move(dir))
    }

    const texts = result.current.log.map((e) => e.text)
    expect(texts).toContain('You enter the roost.')
    expect(texts.some((t) => t.endsWith('— slain!'))).toBe(true)
    // Ids are unique and monotonic so React keys stay stable.
    const ids = result.current.log.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ignores a move into a wall — no step, no turn', () => {
    const { result } = renderHook(() => useNoragon())
    act(() => result.current.start())
    const before = result.current.player

    // The hero starts hard against the west wall; stepping left is impossible.
    act(() => result.current.move('left'))

    expect(result.current.player).toEqual(before)
    expect(result.current.turns).toBe(0)
    expect(result.current.status).toBe('playing')
  })
})

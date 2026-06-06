# Legends of Noragon ⚔️

An embeddable React + TypeScript **turn-based, top-down dungeon crawler**. Move
the hero one tile at a time with the **arrow keys** (or **WASD**), bump bats to
slay them, clear the room, and step onto the chest to complete the level.

Built with **Vite** and tested with **Vitest** + **React Testing Library**.

## Quick start

```bash
npm install
npm run dev        # demo site at http://localhost:5173
npm test           # run the test suite
npm run build      # build the demo site for deployment
npm run build:lib  # build the embeddable component library
```

## How to play

Every run is a **procedurally generated dungeon** — a grid of rooms joined by
random doorways, built from the run's seed. No two runs are alike: the **map size**
varies (2×2 up to 3×3 rooms), the **footprint is irregular** (some cells are
missing, giving L-shapes and notches), and **room sizes vary** (cramped closets
next to open halls). You start safe in **the entry hall**; the **chest** (`▣`, the
win tile) waits in the farthest room, which is guarded. Find a route through the
rooms, fight or dodge what's in the way, and step onto the chest to clear the
level. Lose all your hit points first and you die in the dark.

Combat:

- **Melee** — bump into a foe to swing. The hero lands a hit 80% of the time for
  a random 3–6 damage, so a kill may take a couple of swings (and a swing can
  whiff).
- **Ranged** — press **F** to take aim (the nearest foe is auto-targeted; **Tab**
  or the arrow keys switch targets, **F**/**Enter** looses an arrow, **Esc**
  cancels) and soften foes from a distance.
- Foes roll their own chance to hit back. **Bats** (3 HP) bite for 1; **Goblins**
  (8 HP) are sturdier and hit for 2. Deeper rooms hold more — and tougher — foes.

Enemies only stir once you enter their room, and each room is shrouded in
**fog of war** until you step inside, at which point it stays lit for the rest of
the level. Standing in a doorway peeks into the room beyond — so you can see what
(and who) is waiting before you commit. Pass a `seed` to replay the exact same
dungeon and combat.

## Embedding the component

```tsx
import { Noragon } from '@norarcasey/legends-of-noragon'
import '@norarcasey/legends-of-noragon/style.css'

export function App() {
  return <Noragon />
}
```

`react` / `react-dom` are peer dependencies you already have.

### Props

| Prop             | Type                      | Default                | Description                                                                                                   |
| ---------------- | ------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `maxHp`          | `number`                  | `12`                   | The hero's starting (and maximum) hit points.                                                                 |
| `attacks`        | `Partial<AttackProfiles>` | melee `0.8` / `3`–`6`  | Override attack profiles; each kind is `{ accuracy, minDamage, maxDamage }`. Only `melee` affects play today. |
| `seed`           | `number`                  | — (random)             | Fix the combat RNG for reproducible runs.                                                                     |
| `enableKeyboard` | `boolean`                 | `true`                 | Move with the arrow keys / WASD.                                                                              |
| `title`          | `string \| null`          | `"Legends of Noragon"` | Heading above the dungeon; pass `null` to hide it.                                                            |
| `className`      | `string`                  | —                      | Extra class on the root element.                                                                              |

### Headless engine

The game logic lives in a framework-free hook if you want to build your own UI:

```tsx
import { useNoragon } from '@norarcasey/legends-of-noragon'

const game = useNoragon({
  maxHp: 12,
  attacks: { melee: { accuracy: 0.8, minDamage: 3, maxDamage: 6 } },
})
// game.tiles, game.player, game.enemies, game.activeEnemies, game.hp, game.kills
// game.attacks.melee / .ranged (.spell reserved), game.aiming, game.targetId
// game.status, game.currentRoom, game.revealedRooms, game.visible (fog mask)
// game.log (turn-by-turn LogEntry[])
// game.start(), game.reset(), game.move("up" | "down" | "left" | "right")
// game.aimStart(), game.aimCycle(+1 | -1), game.aimCancel(), game.fire()
```

The whole level — the hero's step plus every enemy's response — is one pure
reducer transition per `move`, so it behaves identically under React
StrictMode and is trivial to drive headlessly in tests.

## Roadmap

You explore a seed-generated dungeon, fight bats and goblins, and grab the
guarded chest. Planned next, in roughly the order it was dreamed up:

- **Spell attacks & ammo** — ranged bow/throw fire is wired up; next is the
  `spell` profile (targeted the same way) and an arrow/quiver resource for ranged.
- **Deeper combat** — building on the chance-to-hit + variable-damage rolls, add
  enemy evasion, criticals, line-of-sight/cover, and per-weapon damage profiles.
- **Loot & equipment** — the chest grants loot (or springs a trap); equip armor,
  weapon, and shield, drink potions, and fire a bow.
- **Descending the stairs** — carry the run into a fresh, deeper generated level.
- **Richer generation** — building on variable map size / irregular footprint /
  varied room sizes: winding corridors (a walkable non-room tile), locked doors
  and keys, and interior cover.
- **More monsters & boss fights** — beyond bats and goblins.
- **Sprites/SVGs** — replacing the block tiles with real art.

## License

MIT © Nora Casey

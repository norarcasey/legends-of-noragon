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

The first dungeon is a hardcoded three-room run:

1. **The entry hall** — empty. Find the doorway east.
2. **The roost** — two bats (3 HP each). Bump into a bat to swing at it: the
   hero lands a hit 80% of the time for a random 2–5 damage, so a kill may take
   a couple of swings — and a swing can whiff. A bat that reaches you rolls its
   own 60% chance to bite for 1. Enemies only stir once you enter their room.
3. **The vault** — a chest (`▣`) and a stairway down (`>`). Step onto the chest
   to clear the level. Lose all your hit points first and you die in the dark.

Each room is shrouded in **fog of war** — you can't see a room or its contents
until you step inside, at which point it stays lit for the rest of the level.

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

| Prop             | Type             | Default                | Description                                        |
| ---------------- | ---------------- | ---------------------- | -------------------------------------------------- |
| `maxHp`          | `number`         | `6`                    | The hero's starting (and maximum) hit points.      |
| `accuracy`       | `number`         | `0.8`                  | Chance (0–1) that a hero melee swing lands.        |
| `minDamage`      | `number`         | `2`                    | Minimum damage a landed hero hit deals.            |
| `maxDamage`      | `number`         | `5`                    | Maximum damage a landed hero hit deals.            |
| `seed`           | `number`         | — (random)             | Fix the combat RNG for reproducible runs.          |
| `enableKeyboard` | `boolean`        | `true`                 | Move with the arrow keys / WASD.                   |
| `title`          | `string \| null` | `"Legends of Noragon"` | Heading above the dungeon; pass `null` to hide it. |
| `className`      | `string`         | —                      | Extra class on the root element.                   |

### Headless engine

The game logic lives in a framework-free hook if you want to build your own UI:

```tsx
import { useNoragon } from '@norarcasey/legends-of-noragon'

const game = useNoragon({ maxHp: 6, accuracy: 0.8, minDamage: 2, maxDamage: 5 })
// game.tiles, game.player, game.enemies, game.activeEnemies, game.hp, game.kills
// game.accuracy, game.minDamage, game.maxDamage (hero combat stats)
// game.status, game.currentRoom, game.revealedRooms, game.visible (fog mask)
// game.log (turn-by-turn LogEntry[])
// game.start(), game.reset(), game.move("up" | "down" | "left" | "right")
```

The whole level — the hero's step plus every enemy's response — is one pure
reducer transition per `move`, so it behaves identically under React
StrictMode and is trivial to drive headlessly in tests.

## Roadmap

This is the MVP: explore three hand-built rooms, fight bats, grab the chest.
Planned, in roughly the order it was dreamed up:

- **Stamina-gated movement** — the displayed stamina pool will start limiting how
  far the hero moves per turn.
- **Deeper combat** — building on the chance-to-hit + variable-damage rolls, add
  enemy evasion, criticals, and per-weapon damage profiles.
- **Loot & equipment** — the chest grants loot (or springs a trap); equip armor,
  weapon, and shield, drink potions, and fire a bow.
- **Descending the stairs** — the stairway carries you to the next level.
- **Procedural dungeons** — generated room layouts with procedurally placed
  monsters, replacing the hardcoded map.
- **More monsters & boss fights** — beyond the humble bat.
- **Sprites/SVGs** — replacing the block tiles with real art.

## License

MIT © Nora Casey

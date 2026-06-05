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

The first dungeon is a hardcoded four-room ring; you work clockwise from the
top-left:

1. **The entry hall** — empty. Find the doorway east.
2. **The roost** — two bats (3 HP each). Bump into a bat to swing at it: the
   hero lands a melee hit 80% of the time for a random 3–6 damage, so a kill may
   take a couple of swings — and a swing can whiff. Or press **F** to take aim
   (the nearest foe is auto-targeted; **Tab** or the arrow keys switch targets,
   **F**/**Enter** looses an arrow, **Esc** cancels) and fight from range. A bat
   that reaches you rolls its own 60% chance to bite for 1.
3. **The goblin den** — a lone **Goblin** (8 HP), far sturdier than a bat and
   hitting for 2 at 70%. Soften it with arrows before it closes, or trade blows.
4. **The vault** — a chest (`▣`) and a stairway down (`>`). Step onto the chest
   to clear the level. Lose all your hit points first and you die in the dark.

Enemies only stir once you enter their room.

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

This is the MVP: explore three hand-built rooms, fight bats, grab the chest.
Planned, in roughly the order it was dreamed up:

- **Spell attacks & ammo** — ranged bow/throw fire is wired up; next is the
  `spell` profile (targeted the same way) and an arrow/quiver resource for ranged.
- **Deeper combat** — building on the chance-to-hit + variable-damage rolls, add
  enemy evasion, criticals, line-of-sight/cover, and per-weapon damage profiles.
- **Loot & equipment** — the chest grants loot (or springs a trap); equip armor,
  weapon, and shield, drink potions, and fire a bow.
- **Descending the stairs** — the stairway carries you to the next level.
- **Procedural dungeons** — generated room layouts with procedurally placed
  monsters, replacing the hardcoded map. The seam is in place: the level is
  produced by `generateDungeon(seed)` and carried in state, so a seeded
  rooms-on-a-grid generator can drop in behind it.
- **More monsters & boss fights** — beyond bats and goblins.
- **Sprites/SVGs** — replacing the block tiles with real art.

## License

MIT © Nora Casey

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

Every run is a **procedurally generated dungeon** — rooms joined by doorways and
winding corridors, built from the run's seed. No two runs are alike: the **map
size** varies (3×3 up to 4×4 rooms), the **footprint is irregular** (some cells
are missing, giving L-shapes and notches), **room sizes vary** (cramped closets
next to open halls), and the rooms are linked by **corridors** that twist through
the dark between them. You start safe in **the entry hall**; the farthest room (a
guarded **vault**) holds a **chest** (`▣`, treasure) and the **stairs down**
(`>`). A run is an **endless descent**: clear or sneak through each level, take
the stairs to a deeper, tougher one, and see how far down you can get before you
die. The stairs are walkable — they don't descend on contact — so you can cross
them to reach the chest or fight the guards; when you're ready, stand on them and
press **`>`** (or the **Descend** button) to drop down.

Combat:

- **Melee** — bump into a foe to swing. The hero lands a hit 80% of the time for
  a random 3–6 damage, so a kill may take a couple of swings (and a swing can
  whiff).
- **Ranged** — press **F** to take aim (the nearest foe is auto-targeted; **Tab**
  or the arrow keys switch targets, **F**/**Enter** looses an arrow, **Esc**
  cancels) and soften foes from a distance.
- Foes roll their own chance to hit back, and the bestiary climbs from fodder to
  horror: **Bats**, **Kobolds**, **Spiders**, and **Dire Wolves** early, then
  **Skeletons**, **Goblins**, and **Orcs**, up to hulking **Ogres**, lumbering
  **Trolls** (20 HP, slam for 5), and deadly **Wraiths** deep down. Each kind has
  a minimum spawn depth, so the heavy hitters stay off the early floors — bats,
  kobolds, spiders, dire wolves, and goblins from the entrance, skeletons and orcs
  from depth 3, ogres and trolls from depth 4, wraiths from depth 5. Rooms farther
  from the
  entrance — and deeper levels — hold more and tougher foes, and the vault is
  always guarded. The
  same kinds also stiffen as you descend: a depth-5 goblin has more HP, hits a
  little harder and more often, and is worth more XP than the one by the entrance.

You begin with a kit — a **Short Sword**, **Traveler's Clothes**, a **Health
Potion**, and a little **gold**. Your equipped weapon adds to your melee damage
and armor subtracts flat **defense** from every hit you take. Loot lies on the
floor (gold piles `$`, potions `!`, weapons `/`, armor `]`) — walk onto it to
pick it up — and chests cough up gold and a potion (sometimes gear). Open the
**Pack** panel to equip better gear, **drink** a potion (or just press `Q` to
quaff), or **drop** an item you don't want (dropping is free and discards it).
Stackable items like potions collapse into one counted row (`Health Potion (3)`),
while gear stays listed per-item so you can equip a specific piece. Your gold and
pack carry down the stairs with you.

Slaying foes earns **XP** (goblins give more than bats). Fill the bar and you
**level up**: your max HP
rises and you're **fully healed**, and every attack gets stronger and more
accurate. Your level, XP, and HP **carry with you down the stairs** — only a
fresh delve (after death) starts back at depth 1, level 1. Deeper levels field
more, tougher foes, so descending is a gamble between growing stronger and
getting overwhelmed.

Enemies only stir once you enter their room, and each room is shrouded in
**fog of war** until you step inside, at which point it stays lit for the rest of
the level. Corridors are dark too — your torch lights them as you walk, and the
trail you've explored stays visible. Standing in a doorway peeks into the room
beyond — so you can see what (and who) is waiting before you commit. Pass a
`seed` to replay the exact same dungeon and combat.

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

| Prop             | Type                      | Default                | Description                                                                                                 |
| ---------------- | ------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `maxHp`          | `number`                  | `12`                   | The hero's level-1 max hit points (grows as you level up).                                                  |
| `attacks`        | `Partial<AttackProfiles>` | melee `0.8` / `3`–`6`  | The hero's level-1 attack profiles; each kind is `{ accuracy, minDamage, maxDamage }` and grows with level. |
| `seed`           | `number`                  | — (random)             | Fix the combat RNG for reproducible runs.                                                                   |
| `enableKeyboard` | `boolean`                 | `true`                 | Move with the arrow keys / WASD.                                                                            |
| `title`          | `string \| null`          | `"Legends of Noragon"` | Heading above the dungeon; pass `null` to hide it.                                                          |
| `className`      | `string`                  | —                      | Extra class on the root element.                                                                            |

### Headless engine

The game logic lives in a framework-free hook if you want to build your own UI:

```tsx
import { useNoragon } from '@norarcasey/legends-of-noragon'

const game = useNoragon({
  maxHp: 12,
  attacks: { melee: { accuracy: 0.8, minDamage: 3, maxDamage: 6 } },
})

// State is grouped into three views plus a few top-level fields:
// game.board  — { cols, rows, tiles, visible (fog mask), floorItems }
// game.hero   — { position, hp, maxHp, level, xp, xpToNext, attacks (.melee /
//                 .ranged, .spell reserved), defense, gold, inventory,
//                 equipment, onStairs }
// game.run    — { status, depth, kills, turns }
// game.enemies, game.activeEnemies, game.currentRoom, game.revealedRooms
// game.aiming, game.targetId, game.log (turn-by-turn LogEntry[])

// Actions stay top-level:
// game.start(), game.reset(), game.move("up" | "down" | "left" | "right")
// game.descend(), game.equip(itemId), game.drink(itemId), game.drop(itemId)
// game.aimStart(), game.aimCycle(+1 | -1), game.aimCancel(), game.fire()
```

The whole level — the hero's step plus every enemy's response — is one pure
reducer transition per `move`, so it behaves identically under React
StrictMode and is trivial to drive headlessly in tests. The reducer's
self-contained helpers (combat/stat math, dungeon spatial queries, the enemy
phase, map generation) live one-per-file under `src/game/utils/`, each with a
co-located unit test.

### Domain model

Every type the game defines — and how they connect — is mapped in
[docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) as Mermaid class diagrams: one
**fully-connected** view of all types plus three focused **area** views (domain,
engine, public API), rendered inline on GitHub. It's generated straight from the
source by `npm run docs:model` (CI fails if the diagram text drifts from the
types), so it always reflects the current `src/game/*.ts` declarations. SVG
renders are produced by the CI **docs** job as a downloadable artifact, or
locally with `npm run docs:render`.

## Roadmap

You explore a seed-generated dungeon, fight bats and goblins, and grab the
guarded chest. Planned next, in roughly the order it was dreamed up:

- **Spell attacks & ammo** — ranged bow/throw fire is wired up; next is the
  `spell` profile (targeted the same way) and an arrow/quiver resource for ranged.
- **Deeper combat** — building on the chance-to-hit + variable-damage rolls, add
  enemy evasion, criticals, line-of-sight/cover, and per-weapon damage profiles.
- **More loot & equipment** — building on weapons/armor/potions/gold: shields,
  rings and trinkets, a shop to spend gold, and chests that sometimes spring traps.
- **Run depth & payoff** — a boss/▼victory at a target depth, rest/heal sites,
  and run summaries, building on the endless-descent loop.
- **Richer generation** — building on variable size / irregular footprint /
  varied rooms / winding corridors: locked doors and keys, interior cover
  (pillars), and themed rooms.
- **More monsters & boss fights** — beyond bats, spiders, goblins, orcs, and
  trolls; special abilities (poison, pack tactics) and a depth boss.
- **Sprites/SVGs** — replacing the block tiles with real art.

## License

MIT © Nora Casey

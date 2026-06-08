# Changelog

All notable changes to this project are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-04

### Changed

- Five new foes join the bestiary: the **Kobold** (weak early scrapper) and
  **Dire Wolf** (fast, accurate pack hunter) on the early floors, the **Skeleton**
  (sturdy undead, depth 3+), the **Ogre** (heavy bruiser between orc and troll,
  depth 4+), and the **Wraith** (deadly, very accurate, depth 5+). Each has its
  own colour, glyph, stats, and minimum spawn depth, and they're woven into the
  threat-scaled spawn pools and the vault-guardian roster.
- Internal refactor: all type and interface declarations moved out of
  `useNoragon.ts` (now logic only) into `types.ts`, and the overlapping stat
  shapes collapsed into a composed family — `HeroStats` (renamed from
  `HeroConfig`), then `CombatStats` extends it with `defense`, then
  `LeveledStats` extends that with `level`/`xp`/`hp` — removing two anonymous
  inline return types. No behavior or public-API change; the same types are
  still exported from the package barrel.
- The Pack panel gained a **Drop** action on every item row (a free menu action,
  exposed as `drop(itemId)` on the hook) that discards the item; dropping a worn
  piece unequips it and re-derives the hero's combat stats first. The Activity Log
  now sits above the Pack in the side panel.
- Each enemy kind now has a minimum spawn depth (`minDepth` in `ENEMY_INFO`), so
  the heavy hitters stay off the early floors: bats, spiders, and goblins from
  depth 1, skeletons and orcs from depth 3, ogres and trolls from depth 4, wraiths
  from depth 5. Spawn pools (including the vault guardian) filter out any kind too
  strong for the current depth.
- Enemies of the same kind now stiffen as the run descends: each foe's max HP,
  damage, accuracy (capped), and slay XP scale up modestly per depth from its
  bestiary baseline, baked onto the foe when it spawns. A depth-5 goblin is a bit
  tougher than the one by the entrance. Tunable via `ENEMY_DEPTH_SCALING`, applied
  by the new `enemyStatsAt(kind, depth)`; `ENEMY_INFO` is now the depth-1 template.
- Pressing **Enter** from a stopped dungeon (the idle screen or after death) now
  begins a fresh run, the same as clicking the Enter / Delve again button.
- The Pack panel orders rows equipped gear first, then consumables, then spare
  (unequipped) gear — so what's worn and what's quaffable sit at the top. The
  spare gear is sorted alphabetically by name.
- The Pack panel now collapses stackable items into a single counted row
  (`Health Potion (3)`) instead of one line per copy, keeping the inventory short.
  Items carry a `stackable` flag (`ITEMS`): consumables stack, while gear stays
  listed per-item so distinct pieces — and, later, same-kind pieces with
  different stats — remain individually equippable.
- The `useNoragon` hook's return value is now grouped for clarity instead of one
  flat object: spatial state lives under `game.board` (`cols`, `rows`, `tiles`,
  `visible`, `floorItems`), the character under `game.hero` (`position` — the old
  `player` — plus `hp`, `maxHp`, `level`, `xp`, `xpToNext`, `attacks`, `defense`,
  `gold`, `inventory`, `equipment`, `onStairs`), and run-level state under
  `game.run` (`status`, `depth`, `kills`, `turns`). Enemies, the activity log,
  aiming, and all action callbacks stay top-level. New exported view types
  `BoardView`, `HeroView`, and `RunView`.

### Added

- Domain model docs: `npm run docs:model` generates
  [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) — Mermaid class diagrams of every
  `interface`/`type` in `src/game/*.ts` and how they connect (inheritance +
  associations) — straight from the source via the TypeScript parser. It emits a
  fully-connected view plus three focused area views (domain, engine, public API,
  with cross-area types shown as `<<external>>` stubs), embedded in the page and
  rendered inline on GitHub. CI regenerates the diagram text and fails if it's
  stale, so the model never drifts from the types. SVG renders aren't committed —
  a dedicated CI **docs** job renders them via `@mermaid-js/mermaid-cli` and
  uploads them as a build artifact (or run `npm run docs:render` locally).
- Initial release of Noragon — An embeddable React turn-based top-down dungeon crawler.
- `<Noragon />` component: renders a hardcoded three-room dungeon as a block
  grid; move the hero with the arrow keys / WASD, bump bats to slay them, and
  step onto the chest to complete the level.
- Fog of war: rooms and their contents (bats, chest, stairs) stay hidden until
  the hero steps into them; the room then stays revealed for the rest of the
  level. Standing in a doorway also peeks into the adjacent room (view only), so
  foes waiting just inside a door are visible before the hero commits to entering.
- Enemy cards: while the hero shares a room with active enemies, a card per
  creature shows its name, description, and a health bar, backed by an
  extensible `ENEMY_INFO` bestiary and an `activeEnemies` field on the hook.
- Activity log: a scrolling, turn-by-turn record of moves, room discoveries,
  strikes, bites, and the run's end, emitted by the reducer as part of each
  transition and exposed as a `log` of `LogEntry` items on the hook.
- Loot & equipment: the hero starts with a kit (Short Sword + Traveler's Clothes
  equipped, a Health Potion, and gold) and can find more. Weapons add to melee
  damage/accuracy; armor gives flat **defense** that soaks each hit. An item
  registry (`ITEMS`) defines weapons, armor, and potions; the dungeon scatters
  gold piles, potions, and gear as floor items you pick up by walking onto them,
  and chests now yield gold + a potion (sometimes gear) instead of XP. New `equip`
  and `drink` actions (drinking costs a turn; `Q` quick-drinks), an inventory
  panel with equip/drink buttons, floor loot on the board, and gold/defense in the
  header. Gold and pack carry down the stairs; a fresh delve restocks the kit.
- Three new foes round out the bestiary: the **Spider** (fragile, fast, accurate),
  the **Orc** (a tanky bruiser between goblin and troll), and the **Troll** (huge
  HP, crushing damage, big XP). Placement draws from a threat-scaled pool — spiders
  appear early, orcs/goblins in the mid rooms, and orcs/trolls deep down, with the
  vault guardian escalating to a troll past depth 4. Each renders in its own colour
  and glyph.
- Descending is now a deliberate action: the stairs (`>`) are walkable and no
  longer descend on contact (which could strand the chest behind them). Stand on
  the stairs and press `>` / Enter, or click the Descend button, to drop down. The
  hook exposes `onStairs` and `descend()`.
- Multi-level runs: the stairs (`>`) now descend to a freshly generated, deeper
  level instead of being inert, and the run is an endless descent (the `won`
  status is gone — death is the only end). The hero's depth, level, XP, HP, and
  stats carry down the stairs, and the combat RNG continues, so a fixed `seed`
  reproduces a whole multi-level run; each depth's map comes from a depth-derived
  seed. Difficulty scales with depth (more, tougher foes). The chest is now
  treasure — opening it grants depth-scaled XP and consumes the tile — rather
  than ending the level. New `depth` on the hook/API and in the header.
- Character leveling: slaying foes grants XP (per-kind, from the bestiary —
  goblins give more than bats). Crossing the XP threshold for the level levels the
  hero up, which raises max HP and **fully heals**, and makes every attack
  (melee/ranged/spell) hit harder and more accurately. Current stats derive from
  the hero's base profile + level via `statsAt`, so they never drift; the curve
  and per-level gains live in a tunable `LEVELING` block. The hook exposes
  `level`, `xp`, and `xpToNext`, shown in the header. Fresh delves restart at
  level 1 (progression will persist once descending stairs lands).
- Melee combat with rolls: the hero attacks via a per-kind `AttackProfile`
  (`accuracy` + `minDamage`/`maxDamage`); the hero starts with 12 HP and melee
  defaults to an 80% hit for 3–6 damage. `ranged` (bow/throw) and `spell` profiles are modeled and tuned now so
  adding them later is a data + targeting change, not a refactor. Bats have 3 HP
  and roll their own 60% chance to bite for 1. Randomness comes from a seeded
  PRNG carried in reducer state, so combat is pure (StrictMode-safe) and
  reproducible from a `seed` — omit it for a fresh random run each game.
- Movement is pure roguelike (one move, one turn); the placeholder stamina stat
  was removed.
- Responsive side-panel layout: the board sits beside the stats / enemy cards /
  activity log on wide screens (stacking on narrow), the board is capped by
  viewport height, and tile glyphs scale to the grid — so a bigger board never
  pushes the cards or log off the bottom of the page.
- Procedural dungeons: `generateDungeon(seed)` builds a randomized
  rooms-on-a-grid level — a seeded RNG carves a spanning set of doors (plus a few
  loops) so every room is reachable, drops the chest in the farthest room, and
  scatters enemies by depth (the start room stays safe, the vault is guarded).
  Every seed is a different, fully-solvable map; pass a `seed` to replay one
  exactly. The dungeon is carried in game state and the spatial helpers
  (`roomAt`, `tileAt`, fog-of-war, enemy chase/phase) take it as input rather
  than a module-level constant.
- Richer generation: the grid size varies per seed (2×2–3×3), the footprint is
  irregular (cells may be omitted while the rest stay connected), and rooms vary
  in size and position within their slots.
- Corridors: rooms are now joined by carved L-shaped corridors (a new walkable
  `corridor` tile) with a `door` at each room mouth, instead of only wall-to-wall
  doors. Corridors aren't part of any room, so a torch-trail `seen` map lights
  them as the hero walks and keeps explored passages visible; the room-based fog
  is overlaid on top. Every generated level is still fully solvable.
- A fourth room and a tougher foe: the dungeon is now a 2×2 clockwise ring —
  entry hall, roost (2 bats), goblin den (1 Goblin: 8 HP, hits for 2 at 70%),
  and the vault with the chest. Enemy combat stats (hp, accuracy, damage, glyph,
  flavor) are data-driven per kind in the `ENEMY_INFO` bestiary, and the shared
  enemy-phase resolver applies each foe's own numbers. Goblins render and card
  in their own colour.
- Ranged attacks with an aiming mode: press F to aim (nearest enemy auto-targeted,
  shown with an on-board reticle and a highlighted enemy card), Tab/arrow keys to
  switch targets, F/Enter to loose an arrow, Esc to cancel. Firing resolves the
  hero's `ranged` profile and costs the turn like any other action; ammo is
  unlimited for now. The hook exposes `aiming`, `targetId`, and
  `aimStart`/`aimCycle`/`aimCancel`/`fire`, and the move and fire turns share one
  enemy-phase resolver.
- `useNoragon()` hook owning the whole game as a single pure reducer.
- Framework-free types and a Vitest + React Testing Library suite (including a
  StrictMode regression test for the reducer).
- Vite library build emitting ESM + bundled type declarations, with `react` and
  `react-dom` kept external as peer dependencies.
- ESLint + Prettier with no-type-assertion and no-non-null-assertion rules, and
  a CI workflow (lint, format, typecheck, test, build) on Node 20.x / 22.x.
- Trusted Publishing release pipeline (GitHub Release → OIDC publish with
  provenance), idempotent so a release for an already-published version is a
  no-op instead of a failure.

[0.1.0]: https://www.npmjs.com/package/@norarcasey/legends-of-noragon/v/0.1.0

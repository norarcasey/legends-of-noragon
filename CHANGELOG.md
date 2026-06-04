# Changelog

All notable changes to this project are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-04

### Added

- Initial release of Noragon — An embeddable React turn-based top-down dungeon crawler.
- `<Noragon />` component: renders a hardcoded three-room dungeon as a block
  grid; move the hero with the arrow keys / WASD, bump bats to slay them, and
  step onto the chest to complete the level.
- Fog of war: rooms and their contents (bats, chest, stairs) stay hidden until
  the hero steps into them; the room then stays revealed for the rest of the level.
- Enemy cards: while the hero shares a room with active enemies, a card per
  creature shows its name, description, and a health bar, backed by an
  extensible `ENEMY_INFO` bestiary and an `activeEnemies` field on the hook.
- Activity log: a scrolling, turn-by-turn record of moves, room discoveries,
  strikes, bites, and the run's end, emitted by the reducer as part of each
  transition and exposed as a `log` of `LogEntry` items on the hook.
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

import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type {
  AttackProfile,
  AttackProfiles,
  CombatFloat,
  Direction,
  Enemy,
  Equipment,
  GameAction,
  GameState,
  GameStatus,
  HeroStats,
  InventoryItem,
  NoragonApi,
  Point,
  Projectile,
  UseNoragonOptions,
} from './types'
import { ENEMY_INFO } from './enemies'
import { ARMOR_KINDS, ITEMS, STARTING_GOLD, WEAPON_KINDS } from './items'
import { DEFAULT_ATTACKS, DEFAULTS, DELTA, DIR_NAME } from './constants'
import {
  activeEnemiesOf,
  applyXp,
  blankSeen,
  computeVisible,
  deriveCombat,
  generateDungeon,
  isActiveFoe,
  logLines,
  makeRoller,
  manhattan,
  markLit,
  resolveAttack,
  reveal,
  roomAt,
  roomsByDoor,
  runEnemyPhase,
  tileAt,
  xpToNext,
} from './utils'

// The whole level lives in one reducer, so each turn — the hero's step plus every
// enemy's response — is computed from the previous state in a single pure
// transition. That keeps it correct under StrictMode's double-invocation, the
// same discipline the other games in this family rely on. The pure helpers it
// leans on (combat math, dungeon spatial queries, the enemy phase, generation)
// live one-per-file under ./utils; the state/action shapes live in ./types.

function makeInitial(config: HeroStats, seed: number): GameState {
  const depth = 1
  const dungeon = generateDungeon(seed, depth)
  const seen = blankSeen(dungeon)
  markLit(seen, dungeon, dungeon.playerStart)

  // Starting kit: a sword and clothes (both equipped), a potion, and some gold.
  const sword: InventoryItem = { id: 0, kind: 'shortSword' }
  const clothes: InventoryItem = { id: 1, kind: 'clothes' }
  const potion: InventoryItem = { id: 2, kind: 'healthPotion' }
  const inventory: InventoryItem[] = [sword, clothes, potion]
  const equipment: Equipment = { weapon: sword.id, armor: clothes.id }
  const stats = deriveCombat(config, 1, inventory, equipment)

  return {
    maxHp: stats.maxHp,
    attacks: stats.attacks,
    defense: stats.defense,
    gold: STARTING_GOLD,
    inventory,
    equipment,
    nextItemId: 3,
    floorItems: dungeon.items.map((i) => ({ ...i })),
    seed,
    depth,
    base: config,
    level: 1,
    xp: 0,
    dungeon,
    player: { ...dungeon.playerStart },
    hp: stats.maxHp,
    enemies: dungeon.enemies.map((e) => ({ ...e })),
    status: 'idle',
    kills: 0,
    turns: 0,
    // The hero can already see the room they start in.
    revealedRooms: reveal([], roomAt(dungeon.rooms, dungeon.playerStart.x, dungeon.playerStart.y)),
    log: [],
    nextLogId: 0,
    effects: [],
    projectiles: [],
    fadingEnemies: [],
    nextEffectId: 0,
    rngState: seed >>> 0,
    aiming: false,
    targetId: null,
    seen,
  }
}

/** Pull the hero's base profile back out so reset/start begins at level 1 again. */
function configOf(state: GameState): HeroStats {
  return state.base
}

/**
 * Take the stairs down: generate the next, deeper level and drop the hero into
 * it, carrying everything about the character (level, xp, hp, stats, kills) and
 * the combat RNG, while resetting the per-level world (map, foes, fog). Pure.
 */
function descend(state: GameState, messages: string[]): GameState {
  const depth = state.depth + 1
  const dungeon = generateDungeon(state.seed, depth)
  const seen = blankSeen(dungeon)
  markLit(seen, dungeon, dungeon.playerStart)
  const startRoom = roomAt(dungeon.rooms, dungeon.playerStart.x, dungeon.playerStart.y)
  messages.push(`You descend the stairs to depth ${depth}.`)
  if (startRoom !== null) messages.push(`You enter ${dungeon.rooms[startRoom].name}.`)
  return {
    ...state,
    depth,
    dungeon,
    player: { ...dungeon.playerStart },
    enemies: dungeon.enemies.map((e) => ({ ...e })),
    floorItems: dungeon.items.map((i) => ({ ...i })),
    revealedRooms: reveal([], startRoom),
    seen,
    aiming: false,
    targetId: null,
    projectiles: [],
    fadingEnemies: [],
    turns: state.turns + 1,
    ...logLines(state.log, state.nextLogId, messages),
  }
}

/** The hero-state fields a single attack can change, plus whether it landed and
 *  the damage it dealt (`0` on a miss) so the reducer can float a number — or a
 *  "miss" — over the target. */
interface HeroAttackOutcome {
  enemies: Enemy[]
  kills: number
  level: number
  xp: number
  maxHp: number
  attacks: AttackProfiles
  defense: number
  hp: number
  hit: boolean
  damage: number
}

/**
 * Resolve one hero attack (melee bump or ranged shot) against `target`: roll to
 * hit, deal damage, and — if it slays the foe — award XP and apply any level-up.
 * Reads the pre-attack hero state from `state` and returns the post-attack values
 * for the reducer to fold in; pushes hit / slain / miss flavor onto `messages`.
 * Shared by the `move` and `fire` turns so both resolve combat identically.
 */
function resolveHeroAttack(
  state: GameState,
  target: Enemy,
  profile: AttackProfile,
  roll: () => number,
  messages: string[],
  flavor: {
    hit: (name: string, damage: number) => string
    slain: (name: string, damage: number, gained: number) => string
    miss: (name: string) => string
  },
): HeroAttackOutcome {
  const unchanged: HeroAttackOutcome = {
    enemies: state.enemies,
    kills: state.kills,
    level: state.level,
    xp: state.xp,
    maxHp: state.maxHp,
    attacks: state.attacks,
    defense: state.defense,
    hp: state.hp,
    hit: false,
    damage: 0,
  }
  const name = ENEMY_INFO[target.kind].name
  const { hit, damage } = resolveAttack(profile, roll)
  if (!hit) {
    messages.push(flavor.miss(name))
    return unchanged
  }
  const enemies = state.enemies
    .map((e) => (e.id === target.id ? { ...e, hp: e.hp - damage } : e))
    .filter((e) => e.hp > 0)
  if (enemies.length === state.enemies.length) {
    // A hit that didn't kill: damage landed, no XP.
    messages.push(flavor.hit(name, damage))
    return { ...unchanged, enemies, hit: true, damage }
  }
  // Slain: award XP and apply any level-up (which fully heals).
  const gained = target.xp
  messages.push(flavor.slain(name, damage, gained))
  const lv = applyXp(
    state.base,
    state.level,
    state.xp,
    state.hp,
    gained,
    messages,
    state.inventory,
    state.equipment,
  )
  return {
    enemies,
    kills: state.kills + 1,
    level: lv.level,
    xp: lv.xp,
    maxHp: lv.maxHp,
    attacks: lv.attacks,
    defense: lv.defense,
    hp: lv.hp,
    hit: true,
    damage,
  }
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'configure':
      return makeInitial(action.config, action.seed)
    case 'reset':
      return makeInitial(configOf(state), action.seed)
    case 'start': {
      const fresh = makeInitial(configOf(state), action.seed)
      const room = roomAt(fresh.dungeon.rooms, fresh.player.x, fresh.player.y)
      const opening = [
        'You descend into the dungeon of Noragon.',
        room !== null ? `You enter ${fresh.dungeon.rooms[room].name}.` : 'You press into the dark.',
      ]
      return { ...fresh, status: 'playing', ...logLines(fresh.log, fresh.nextLogId, opening) }
    }
    case 'move': {
      if (state.status !== 'playing') return state

      const delta = DELTA[action.dir]
      const target = { x: state.player.x + delta.x, y: state.player.y + delta.y }
      const targetBat = state.enemies.find((e) => e.x === target.x && e.y === target.y)

      let player = state.player
      let enemies = state.enemies
      let kills = state.kills
      // Leveling carries through the turn; a kill may raise these and refill hp.
      let level = state.level
      let xp = state.xp
      let maxHp = state.maxHp
      let attacks = state.attacks
      let defense = state.defense
      let hp = state.hp
      // Loot the hero may gain this turn (chest, floor pickups).
      let gold = state.gold
      let inventory = state.inventory
      let nextItemId = state.nextItemId
      let floorItems = state.floorItems
      // The dungeon can change this turn (opening a chest consumes its tile).
      let dungeon = state.dungeon
      const messages: string[] = []
      // Floating combat numbers emitted this turn (damage dealt / taken).
      let nextEffectId = state.nextEffectId
      const floats: CombatFloat[] = []

      // Re-light the torch radius around wherever the hero ends up this turn.
      const litSeen = (p: Point): boolean[][] => {
        const s = state.seen.map((row) => [...row])
        markLit(s, dungeon, p)
        return s
      }

      // All combat randomness flows through one roller seeded from state, so the
      // whole turn stays a pure function of (state, action).
      const rng = makeRoller(state.rngState)

      if (targetBat) {
        // Bump-to-attack resolves the hero's melee profile against the foe.
        const a = resolveHeroAttack(state, targetBat, state.attacks.melee, rng.roll, messages, {
          hit: (name, dmg) => `You strike the ${name} for ${dmg}.`,
          slain: (name, dmg, gained) =>
            `You strike the ${name} for ${dmg} — slain! (+${gained} XP)`,
          miss: (name) => `You swing at the ${name} and miss.`,
        })
        enemies = a.enemies
        kills = a.kills
        level = a.level
        xp = a.xp
        maxHp = a.maxHp
        attacks = a.attacks
        defense = a.defense
        hp = a.hp
        if (!a.hit) {
          floats.push({ id: nextEffectId++, x: target.x, y: target.y, amount: 0, tone: 'miss' })
        } else if (a.damage > 0) {
          floats.push({
            id: nextEffectId++,
            x: target.x,
            y: target.y,
            amount: a.damage,
            tone: 'damage',
          })
        }
      } else if (tileAt(state.dungeon, target.x, target.y) === 'wall') {
        // Bumping a wall is not a turn — nothing happens, and nothing is logged.
        return state
      } else {
        const tile = tileAt(state.dungeon, target.x, target.y)
        player = target
        messages.push(`You move ${DIR_NAME[action.dir]}.`)
        // The stairs are walkable; descending is a deliberate action (see below).
        // A chest is treasure: gold + a potion (+ chance of gear), then consumed.
        if (tile === 'chest') {
          gold += 10 + state.depth * 8
          messages.push(
            `You pry open the chest — ${10 + state.depth * 8} gold and a Health Potion!`,
          )
          inventory = [...inventory, { id: nextItemId++, kind: 'healthPotion' }]
          if (rng.roll() < 0.5) {
            const pool = rng.roll() < 0.5 ? WEAPON_KINDS : ARMOR_KINDS
            const tier = Math.min(pool.length - 1, 1 + Math.floor(state.depth / 2))
            const kind = pool[tier]
            inventory = [...inventory, { id: nextItemId++, kind }]
            messages.push(`The chest also holds a ${ITEMS[kind].name}!`)
          }
          const tiles = dungeon.tiles.map((row) => [...row])
          tiles[player.y][player.x] = 'floor'
          dungeon = { ...dungeon, tiles }
        }
        // Pick up any loot lying on the tile the hero stepped onto.
        const loot = floorItems.find((i) => i.x === player.x && i.y === player.y)
        if (loot) {
          floorItems = floorItems.filter((i) => i !== loot)
          if (loot.kind === 'gold') {
            gold += loot.amount
            messages.push(`You find ${loot.amount} gold.`)
          } else {
            inventory = [...inventory, { id: nextItemId++, kind: loot.kind }]
            messages.push(`You pick up a ${ITEMS[loot.kind].name}.`)
          }
        }
        // Announce crossing into a room the hero hasn't been in before.
        const steppedInto = roomAt(dungeon.rooms, player.x, player.y)
        if (steppedInto !== null && !state.revealedRooms.includes(steppedInto)) {
          messages.push(`You enter ${dungeon.rooms[steppedInto].name}.`)
        }
      }

      // Light up the room the hero just stepped into (a no-op if already known).
      const revealedRooms = reveal(state.revealedRooms, roomAt(dungeon.rooms, player.x, player.y))

      const phase = runEnemyPhase(dungeon, player, enemies, hp, defense, rng.roll, messages)
      const status: GameStatus = phase.hp <= 0 ? 'dead' : 'playing'
      if (status === 'dead') messages.push('You collapse, slain in the dark.')
      // Over the hero's tile: the damage the foes dealt this phase, or — if they
      // all whiffed — a single "miss" so a dodged turn still reads at a glance.
      if (hp - phase.hp > 0) {
        floats.push({
          id: nextEffectId++,
          x: player.x,
          y: player.y,
          amount: hp - phase.hp,
          tone: 'damage',
        })
      } else if (phase.misses > 0) {
        floats.push({ id: nextEffectId++, x: player.x, y: player.y, amount: 0, tone: 'miss' })
      }

      return {
        ...state,
        dungeon,
        player,
        hp: Math.max(0, phase.hp),
        maxHp,
        attacks,
        defense,
        gold,
        inventory,
        nextItemId,
        floorItems,
        level,
        xp,
        enemies: phase.enemies,
        kills,
        status,
        turns: state.turns + 1,
        revealedRooms,
        effects: floats,
        // No arrow this turn; clear any from a prior shot so impact timing on a
        // tile a past arrow targeted isn't mistaken for a ranged hit.
        projectiles: [],
        fadingEnemies: [],
        nextEffectId,
        rngState: rng.state(),
        seen: litSeen(player),
        // Stepping ends any aim that was somehow still open.
        aiming: false,
        targetId: null,
        ...logLines(state.log, state.nextLogId, messages),
      }
    }
    case 'descend': {
      // Deliberate: only works while the hero is standing on the stairs, so the
      // stairs never block the way to the chest or a fight.
      if (state.status !== 'playing') return state
      if (tileAt(state.dungeon, state.player.x, state.player.y) !== 'stairs') return state
      return descend(state, [])
    }
    case 'equip': {
      // Swapping gear is a free menu action (no turn). It re-derives the hero's
      // melee bonus and defense from the newly equipped weapon/armor.
      if (state.status !== 'playing') return state
      const item = state.inventory.find((i) => i.id === action.itemId)
      if (!item) return state
      const def = ITEMS[item.kind]
      if (def.category !== 'weapon' && def.category !== 'armor') return state
      const slot: 'weapon' | 'armor' = def.category
      if (state.equipment[slot] === item.id) return state
      const equipment: Equipment = { ...state.equipment, [slot]: item.id }
      const c = deriveCombat(state.base, state.level, state.inventory, equipment)
      return {
        ...state,
        equipment,
        maxHp: c.maxHp,
        attacks: c.attacks,
        defense: c.defense,
        hp: Math.min(state.hp, c.maxHp),
        ...logLines(state.log, state.nextLogId, [`You equip the ${def.name}.`]),
      }
    }
    case 'drink': {
      // Quaffing a potion costs a turn — foes act after you drink.
      if (state.status !== 'playing') return state
      const item = state.inventory.find((i) => i.id === action.itemId)
      if (!item || ITEMS[item.kind].category !== 'potion') return state
      if (state.hp >= state.maxHp) {
        return {
          ...state,
          ...logLines(state.log, state.nextLogId, ['You are already at full health.']),
        }
      }
      const messages: string[] = []
      const rng = makeRoller(state.rngState)
      const healed = Math.min(state.maxHp, state.hp + ITEMS[item.kind].heal)
      messages.push(`You drink a ${ITEMS[item.kind].name} and recover ${healed - state.hp} HP.`)
      const inventory = state.inventory.filter((i) => i.id !== item.id)
      let nextEffectId = state.nextEffectId
      const floats: CombatFloat[] = [
        {
          id: nextEffectId++,
          x: state.player.x,
          y: state.player.y,
          amount: healed - state.hp,
          tone: 'heal',
        },
      ]
      const phase = runEnemyPhase(
        state.dungeon,
        state.player,
        state.enemies,
        healed,
        state.defense,
        rng.roll,
        messages,
      )
      const status: GameStatus = phase.hp <= 0 ? 'dead' : 'playing'
      if (status === 'dead') messages.push('You collapse, slain in the dark.')
      if (healed - phase.hp > 0) {
        floats.push({
          id: nextEffectId++,
          x: state.player.x,
          y: state.player.y,
          amount: healed - phase.hp,
          tone: 'damage',
        })
      }
      return {
        ...state,
        inventory,
        hp: Math.max(0, phase.hp),
        enemies: phase.enemies,
        status,
        turns: state.turns + 1,
        effects: floats,
        projectiles: [],
        fadingEnemies: [],
        nextEffectId,
        rngState: rng.state(),
        ...logLines(state.log, state.nextLogId, messages),
      }
    }
    case 'drop': {
      // Discarding is a free menu action (no turn). If the item was equipped,
      // clear that slot and re-derive the hero's combat stats from what remains.
      if (state.status !== 'playing') return state
      const item = state.inventory.find((i) => i.id === action.itemId)
      if (!item) return state
      const inventory = state.inventory.filter((i) => i.id !== item.id)
      const equipment: Equipment = {
        weapon: state.equipment.weapon === item.id ? null : state.equipment.weapon,
        armor: state.equipment.armor === item.id ? null : state.equipment.armor,
      }
      const c = deriveCombat(state.base, state.level, inventory, equipment)
      return {
        ...state,
        inventory,
        equipment,
        maxHp: c.maxHp,
        attacks: c.attacks,
        defense: c.defense,
        hp: Math.min(state.hp, c.maxHp),
        ...logLines(state.log, state.nextLogId, [`You drop the ${ITEMS[item.kind].name}.`]),
      }
    }
    case 'aimStart': {
      if (state.status !== 'playing') return state
      // Standing in a doorway engages the peeked room(s), so the hero can aim
      // into the room beyond and loose an opportunity shot from the threshold.
      const actives = activeEnemiesOf(
        state.dungeon.rooms,
        state.player,
        state.enemies,
        roomsByDoor(state.dungeon, state.player),
      )
      if (actives.length === 0) {
        return {
          ...state,
          ...logLines(state.log, state.nextLogId, ['There is nothing in range to shoot.']),
        }
      }
      // Auto-select the nearest enemy as the starting target.
      let nearest = actives[0]
      for (const e of actives) {
        if (manhattan(e, state.player) < manhattan(nearest, state.player)) nearest = e
      }
      return { ...state, aiming: true, targetId: nearest.id }
    }
    case 'aimCycle': {
      if (!state.aiming) return state
      // Standing in a doorway engages the peeked room(s), so the hero can aim
      // into the room beyond and loose an opportunity shot from the threshold.
      const actives = activeEnemiesOf(
        state.dungeon.rooms,
        state.player,
        state.enemies,
        roomsByDoor(state.dungeon, state.player),
      )
      if (actives.length === 0) return { ...state, aiming: false, targetId: null }
      const current = actives.findIndex((e) => e.id === state.targetId)
      const base = current === -1 ? 0 : current
      const next = (base + action.delta + actives.length) % actives.length
      return { ...state, targetId: actives[next].id }
    }
    case 'aimCancel':
      if (!state.aiming) return state
      return { ...state, aiming: false, targetId: null }
    case 'fire': {
      if (state.status !== 'playing' || !state.aiming) return state
      // The peeked rooms when standing in a doorway — fired into as an
      // opportunity shot, and roused to respond afterward.
      const engaged = roomsByDoor(state.dungeon, state.player)
      const target = state.enemies.find((e) => e.id === state.targetId)
      // Target must still be a foe the hero can actually shoot — in the room, a
      // peeked room from a doorway, or adjacent.
      if (!target || !isActiveFoe(state.dungeon.rooms, state.player, target, engaged)) {
        return { ...state, aiming: false, targetId: null }
      }

      const rng = makeRoller(state.rngState)
      const messages: string[] = []
      let nextEffectId = state.nextEffectId
      const floats: CombatFloat[] = []

      // The hero looses an arrow: resolve the ranged profile, then enemies act.
      const a = resolveHeroAttack(state, target, state.attacks.ranged, rng.roll, messages, {
        hit: (name, dmg) => `You shoot the ${name} for ${dmg}.`,
        slain: (name, dmg, gained) => `You shoot the ${name} for ${dmg} — slain! (+${gained} XP)`,
        miss: (name) => `Your arrow misses the ${name}.`,
      })

      const phase = runEnemyPhase(
        state.dungeon,
        state.player,
        a.enemies,
        a.hp,
        a.defense,
        rng.roll,
        messages,
        engaged,
      )
      const status: GameStatus = phase.hp <= 0 ? 'dead' : 'playing'
      if (status === 'dead') messages.push('You collapse, slain in the dark.')

      // The arrow flies to where the target stood when struck, and its burst and
      // number land there too. The view holds the foe at that tile until the
      // arrow arrives, then plays out its move (it glides away) or death (it
      // fades) — so the hit always reads before the foe reacts.
      const projectiles: Projectile[] = [
        {
          id: nextEffectId++,
          fromX: state.player.x,
          fromY: state.player.y,
          toX: target.x,
          toY: target.y,
          kind: 'arrow',
        },
      ]
      if (!a.hit) {
        floats.push({ id: nextEffectId++, x: target.x, y: target.y, amount: 0, tone: 'miss' })
      } else if (a.damage > 0) {
        floats.push({
          id: nextEffectId++,
          x: target.x,
          y: target.y,
          amount: a.damage,
          tone: 'damage',
        })
      }
      // If the shot killed it, keep the foe one turn so the view can fade it out
      // where it fell (after the arrow lands) rather than vanishing at launch.
      const slain = !phase.enemies.some((e) => e.id === target.id)
      const fadingEnemies = slain ? [{ ...target }] : []

      if (a.hp - phase.hp > 0) {
        floats.push({
          id: nextEffectId++,
          x: state.player.x,
          y: state.player.y,
          amount: a.hp - phase.hp,
          tone: 'damage',
        })
      } else if (phase.misses > 0) {
        floats.push({
          id: nextEffectId++,
          x: state.player.x,
          y: state.player.y,
          amount: 0,
          tone: 'miss',
        })
      }

      return {
        ...state,
        hp: Math.max(0, phase.hp),
        maxHp: a.maxHp,
        attacks: a.attacks,
        defense: a.defense,
        level: a.level,
        xp: a.xp,
        enemies: phase.enemies,
        kills: a.kills,
        status,
        turns: state.turns + 1,
        aiming: false,
        targetId: null,
        effects: floats,
        projectiles,
        fadingEnemies,
        nextEffectId,
        rngState: rng.state(),
        ...logLines(state.log, state.nextLogId, messages),
      }
    }
  }
}

export function useNoragon(options: UseNoragonOptions = {}): NoragonApi {
  const maxHp = options.maxHp ?? DEFAULTS.maxHp
  const seed = options.seed

  // Flatten the attack overrides to primitives so the config effect depends on
  // actual values, not the identity of an inline `attacks` object (which would
  // otherwise re-fire every render and reset the game mid-play).
  const a = options.attacks
  const meleeAccuracy = a?.melee?.accuracy ?? DEFAULT_ATTACKS.melee.accuracy
  const meleeMinDamage = a?.melee?.minDamage ?? DEFAULT_ATTACKS.melee.minDamage
  const meleeMaxDamage = a?.melee?.maxDamage ?? DEFAULT_ATTACKS.melee.maxDamage
  const rangedAccuracy = a?.ranged?.accuracy ?? DEFAULT_ATTACKS.ranged.accuracy
  const rangedMinDamage = a?.ranged?.minDamage ?? DEFAULT_ATTACKS.ranged.minDamage
  const rangedMaxDamage = a?.ranged?.maxDamage ?? DEFAULT_ATTACKS.ranged.maxDamage
  const spellAccuracy = a?.spell?.accuracy ?? DEFAULT_ATTACKS.spell.accuracy
  const spellMinDamage = a?.spell?.minDamage ?? DEFAULT_ATTACKS.spell.minDamage
  const spellMaxDamage = a?.spell?.maxDamage ?? DEFAULT_ATTACKS.spell.maxDamage

  const attacks = useMemo<AttackProfiles>(
    () => ({
      melee: { accuracy: meleeAccuracy, minDamage: meleeMinDamage, maxDamage: meleeMaxDamage },
      ranged: { accuracy: rangedAccuracy, minDamage: rangedMinDamage, maxDamage: rangedMaxDamage },
      spell: { accuracy: spellAccuracy, minDamage: spellMinDamage, maxDamage: spellMaxDamage },
    }),
    [
      meleeAccuracy,
      meleeMinDamage,
      meleeMaxDamage,
      rangedAccuracy,
      rangedMinDamage,
      rangedMaxDamage,
      spellAccuracy,
      spellMinDamage,
      spellMaxDamage,
    ],
  )

  // A fixed `seed` makes every run reproducible; otherwise each (re)start draws
  // a fresh random seed. Generated outside the reducer so the reducer stays pure.
  const makeSeed = useCallback(() => seed ?? Math.floor(Math.random() * 0x7fffffff), [seed])

  const [state, dispatch] = useReducer(reducer, undefined, () =>
    makeInitial({ maxHp, attacks }, seed ?? 1),
  )

  // Re-lay the dungeon whenever the hero's profile changes.
  useEffect(() => {
    dispatch({ type: 'configure', config: { maxHp, attacks }, seed: makeSeed() })
  }, [maxHp, attacks, makeSeed])

  const start = useCallback(() => dispatch({ type: 'start', seed: makeSeed() }), [makeSeed])
  const reset = useCallback(() => dispatch({ type: 'reset', seed: makeSeed() }), [makeSeed])
  const move = useCallback((dir: Direction) => dispatch({ type: 'move', dir }), [])
  const descendAction = useCallback(() => dispatch({ type: 'descend' }), [])
  const equip = useCallback((itemId: number) => dispatch({ type: 'equip', itemId }), [])
  const drink = useCallback((itemId: number) => dispatch({ type: 'drink', itemId }), [])
  const drop = useCallback((itemId: number) => dispatch({ type: 'drop', itemId }), [])
  const aimStart = useCallback(() => dispatch({ type: 'aimStart' }), [])
  const aimCycle = useCallback((delta: number) => dispatch({ type: 'aimCycle', delta }), [])
  const aimCancel = useCallback(() => dispatch({ type: 'aimCancel' }), [])
  const fire = useCallback(() => dispatch({ type: 'fire' }), [])

  // "Active" foes — sharing the hero's room, right beside them, or in a room
  // being peeked from a doorway — are the ones shown as cards and targetable.
  // (Peeked foes only *act* once engaged by a shot; see the `fire` reducer case.)
  const currentRoom = roomAt(state.dungeon.rooms, state.player.x, state.player.y)
  const activeEnemies = activeEnemiesOf(
    state.dungeon.rooms,
    state.player,
    state.enemies,
    roomsByDoor(state.dungeon, state.player),
  )
  const onStairs = tileAt(state.dungeon, state.player.x, state.player.y) === 'stairs'

  // Fog: revealed rooms (plus a doorway peek) lit permanently, with the torch
  // trail overlaid so explored corridors stay visible.
  const visible = computeVisible(state.dungeon, [
    ...state.revealedRooms,
    ...roomsByDoor(state.dungeon, state.player),
  ])
  for (let y = 0; y < state.dungeon.rows; y++) {
    for (let x = 0; x < state.dungeon.cols; x++) {
      if (state.seen[y][x]) visible[y][x] = true
    }
  }

  return {
    board: {
      cols: state.dungeon.cols,
      rows: state.dungeon.rows,
      tiles: state.dungeon.tiles,
      visible,
      floorItems: state.floorItems,
    },
    hero: {
      position: state.player,
      hp: state.hp,
      maxHp: state.maxHp,
      level: state.level,
      xp: state.xp,
      xpToNext: xpToNext(state.level),
      attacks: state.attacks,
      defense: state.defense,
      gold: state.gold,
      inventory: state.inventory,
      equipment: state.equipment,
      onStairs,
    },
    run: {
      status: state.status,
      depth: state.depth,
      kills: state.kills,
      turns: state.turns,
    },
    enemies: state.enemies,
    activeEnemies,
    currentRoom,
    revealedRooms: state.revealedRooms,
    aiming: state.aiming,
    targetId: state.targetId,
    log: state.log,
    effects: state.effects,
    projectiles: state.projectiles,
    fadingEnemies: state.fadingEnemies,
    start,
    reset,
    move,
    descend: descendAction,
    equip,
    drink,
    drop,
    aimStart,
    aimCycle,
    aimCancel,
    fire,
  }
}

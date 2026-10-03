import { enemyData } from '../../game-data/enemies/roster';
import type { EnemyData } from '../../game-data/enemies/roster';
import { bossRoster } from '../../game-data/bosses/roster';
import type { BossData } from '../../game-data/bosses/schema';
import { EnemyFSM, STRIKE } from '../ai/EnemyFSM';
import { BossDirector, LEAP_TIME } from '../bosses/BossDirector';
import { makeCombatant } from '../combat/CombatSystem';
import type { Combatant, Hitbox } from '../combat/CombatSystem';
import { arenas } from '../../game-data/zones/laboratory';
import type { Arena, ChunkData } from '../../game-data/zones/laboratory';
import { bodyBand, walkableSpan, clampToGates } from './Terrain';
import type { Solid } from './Terrain';
import { worldSolids } from '../world/Rooms';
/** Solid slabs and chamber walls of the whole world, used to bound enemy movement. */
const solids: Solid[] = worldSolids;
/** Seconds between two pulses of a planted standard. */
export const STANDARD_INTERVAL = 1.3;
/** Seconds between two shots of a reflection. */
export const REFLECTION_SHOT = 1.6;
/** Eidra has moved under the Guardian's gaze beyond this distance, metres. */
export const GAZE_TOLERANCE = 0.45;
/** A banner planted by a boss: it keeps pulsing while its bearer fights on. */
export interface Standard {
  x: number;
  /** Seconds left before it falls. */
  life: number;
  /** Seconds until the next pulse. */
  next: number;
  damage: number;
}
/** A fire geyser of an eruption, burning for a moment at one spot. */
export interface Geyser {
  x: number;
  life: number;
  hit: boolean;
  damage: number;
}
/** An illusory copy of a boss: shatters in one blow, shoots while it lasts. */
export interface Reflection {
  actor: Combatant;
  life: number;
  next: number;
  damage: number;
}
/** A bound through the air, from where the boss left to its mark. */
export interface Leap {
  from: number;
  to: number;
}
/**
 * A boss fight: the body, its director and whether it has fallen for good. Bosses
 * are not streamed with the sectors; they wait, dormant, in their arena. Lasting
 * effects of the signature abilities live here, for the presentation to read.
 */
export class BossEncounter {
  readonly actor: Combatant;
  readonly arena: Arena;
  director: BossDirector;
  /** Fallen for good (persists in the save). */
  defeated = false;
  /** Its victory has been celebrated and rewarded. */
  rewarded = false;
  standard: Standard | null = null;
  /** True on the step the standard pulses. */
  pulsed = false;
  geysers: Geyser[] = [];
  reflections: Reflection[] = [];
  leap: Leap | null = null;
  /** Where Eidra stood at the last check of a command. */
  gaze: { x: number; y: number } | null = null;
  /** Seconds of the gaze's flash after punishing a movement. */
  punished = 0;
  /** Reflections placed so far: the real body takes a different place each time. */
  private mirrors = 0;
  lastHealth: number;
  constructor(readonly data: BossData) {
    const arena = arenas.find((a) => a.id === data.arena);
    if (!arena) throw new Error(`Boss ${data.id} has no arena ${data.arena}`);
    this.arena = arena;
    this.actor = makeCombatant(
      data.id,
      data.health,
      data.spawn.x,
      data.spawn.y,
      data.radius,
      data.height,
    );
    this.director = new BossDirector(data, this.bounds);
    this.lastHealth = data.health;
  }
  /** Places of the reflections and the real body, across the roaming range. */
  mirrorSlots(): number[] {
    const [low, high] = this.arena.roam;
    return [low + 3, (low + high) / 2, high - 3];
  }
  /** Which slot the real body takes for the next reflections. */
  nextMirror(): number {
    return (this.mirrors++ * 2 + 1) % 3;
  }
  /** Where its blows may land: the arena, inside its gates. */
  get bounds(): [number, number] {
    return [this.arena.left + 1, this.arena.right - 1];
  }
  /** Awake and fighting. */
  get active(): boolean {
    return !this.defeated && !['dormant', 'dead'].includes(this.director.state);
  }
  reset(): void {
    this.director = new BossDirector(this.data, this.bounds);
    this.actor.health = this.defeated ? 0 : this.data.health;
    this.actor.x = this.data.spawn.x;
    this.actor.invulnerable = 0;
    this.actor.stagger = 0;
    this.actor.knockback = 0;
    this.rewarded = this.defeated;
    this.standard = null;
    this.pulsed = false;
    this.geysers = [];
    this.reflections = [];
    this.leap = null;
    this.gaze = null;
    this.punished = 0;
    this.mirrors = 0;
    this.lastHealth = this.actor.health;
  }
}
/** Approach speed factor of each gait at a moment of its cycle. */
export function gaitStride(movement: BossData['movement'], time: number): number {
  switch (movement) {
    case 'march':
      // Heavy steps: surging on each footfall, nearly still between.
      return 0.35 + 1.25 * Math.abs(Math.sin(time * Math.PI * 1.4));
    case 'leap':
      // Bounds: fast through the air, a pause on landing.
      return (time % 0.75) / 0.75 < 0.55 ? 2 : 0.15;
    default:
      return 1;
  }
}
export interface EnemyEntity {
  actor: Combatant;
  fsm: EnemyFSM;
  data: EnemyData;
  home: number;
  /** Patrol range intersected with the floor and the slabs around the spawn. */
  patrol: readonly [number, number];
  kind: string;
  facing: number;
  rewarded: boolean;
  /** Top of the floor under its spawn, where its warning ring is drawn. */
  ground: number;
  /** Height a flyer hovers at, and climbs back to after a dive. */
  altitude: number;
  /** A dive under way: where it heads, and whether it has struck yet. */
  dive: { x: number; y: number; struck: boolean } | null;
  /** Seconds a slow-turning shell has been facing away from Eidra. */
  turning: number;
}
/**
 * A shell guards the side its bearer faces: a blow travelling towards its face
 * glances off, unless it reels from its own lunge. From behind, or from above
 * (a plunge), it is open.
 */
export function guarded(entity: EnemyEntity, direction: number, plunge: boolean): boolean {
  if (entity.data.guard !== 'front' || plunge) return false;
  if (entity.fsm.state === 'RECOVER' || entity.fsm.state === 'STAGGER') return false;
  return direction === -entity.facing;
}
/** Seconds a guarded body takes to turn round: long enough to get behind its shell. */
export const TURN_TIME = 0.9;
/** Climb back to its altitude after a dive, m/s. */
const CLIMB = 3.2;
export interface Projectile {
  sourceId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  /** It has flown in the open: from now on a wall breaks it (a shard may fall from inside a ledge). */
  clear?: boolean;
}
/** Where shots may fly. */
export interface ShotSpace {
  /** Inside a wall, a slab, a closed seal or gate: a shot breaks there. */
  blocked: (x: number, y: number) => boolean;
  /** Within a room on screen: a shot that leaves the shown rooms is gone. */
  open: (x: number, y: number) => boolean;
}
export class EnemyManager {
  readonly entities = new Map<string, EnemyEntity>();
  readonly defeated = new Set<string>();
  readonly bosses = bossRoster.map((data) => new BossEncounter(data));
  projectiles: Projectile[] = [];
  encounter(id: string): BossEncounter | undefined {
    return this.bosses.find((b) => b.data.id === id);
  }
  sync(data: ChunkData[]): void {
    const ids = new Set(data.flatMap((chunk) => chunk.enemies.map((e) => e.id)));
    for (const id of this.entities.keys()) if (!ids.has(id)) this.entities.delete(id);
    for (const chunk of data)
      for (const spawn of chunk.enemies) {
        if (this.entities.has(spawn.id) || this.defeated.has(spawn.id)) continue;
        const base = enemyData[spawn.kind];
        const radius = base.scale * 0.45,
          height = base.scale * 1.8;
        const [low, high] = spawn.patrol ?? [spawn.x - 9, spawn.x + 9];
        const [floorMin, floorMax] = walkableSpan(
          solids,
          spawn.x,
          spawn.y,
          radius,
          height,
          base.flying,
        );
        const floor = bodyBand(solids, spawn.x, spawn.y, height)?.[0] ?? spawn.y - 1;
        this.entities.set(spawn.id, {
          ground: floor,
          altitude: spawn.y,
          dive: null,
          turning: 0,
          actor: makeCombatant(spawn.id, base.health, spawn.x, spawn.y, radius, height),
          fsm: new EnemyFSM(base),
          data: base,
          home: spawn.x,
          patrol: [Math.max(low, floorMin), Math.min(high, floorMax)],
          kind: spawn.kind,
          facing: -1,
          rewarded: false,
        });
      }
  }
  update(
    dt: number,
    player: Combatant,
    onAttack: (hit: Hitbox, source: Combatant) => void,
    gates: readonly number[] = [],
    /** A downward strike is under way: bodies below Eidra are being struck, not touched. */
    plunging = false,
    /** Walls and rooms: shots break on the one and stay within the other. */
    space: ShotSpace | null = null,
  ): void {
    for (const entity of this.entities.values()) {
      const a = entity.actor,
        delta = player.x - a.x;
      const toward = Math.sign(delta) || 1;
      // A shell turns round slowly, and never in the middle of a blow.
      if (entity.data.guard === 'front' && toward !== entity.facing) {
        const busy = entity.fsm.state === 'ALERT' || entity.fsm.state === 'ATTACK';
        entity.turning = busy ? entity.turning : entity.turning + dt;
        if (entity.turning >= TURN_TIME) {
          entity.facing = toward;
          entity.turning = 0;
        }
      } else {
        entity.facing = toward;
        entity.turning = 0;
      }
      entity.fsm.update(dt, {
        distance: Math.hypot(delta, player.y - a.y),
        homeDistance: Math.abs(a.x - entity.home),
        health: a.health,
        stagger: a.stagger,
        maxHealth: a.maxHealth,
      });
      if (a.health <= 0) {
        this.defeated.add(a.id);
        continue;
      }
      // A shell turning round stands still until it faces Eidra again.
      if (entity.fsm.state === 'CHASE' && entity.turning === 0)
        a.x += entity.facing * entity.data.speed * entity.fsm.pace * dt;
      // A lunge carries the body forward during the blow.
      if (entity.fsm.state === 'ATTACK' && entity.data.lunge > 0 && entity.fsm.timer <= STRIKE)
        a.x += entity.facing * (entity.data.lunge / STRIKE) * dt;
      if (entity.fsm.state === 'RETURN')
        a.x += Math.sign(entity.home - a.x) * entity.data.speed * dt;
      if (entity.fsm.state === 'PATROL') a.x += Math.sin(entity.fsm.timer * 2) * dt * 0.5;
      a.x = clampToGates(a.x + a.knockback * dt, entity.home, a.radius, gates, entity.patrol);
      // A diver drops on where Eidra was, then climbs back to its height.
      if (entity.data.swoop > 0) this.swoop(entity, player, dt, onAttack);
      if (
        entity.data.contact > 0 &&
        !entity.fsm.dormant &&
        touching(a, player) &&
        !(plunging && a.y < player.y)
      )
        onAttack(contact(a, player, entity.data.contact), a);
      if (entity.fsm.attackTriggered && entity.data.swoop > 0) {
        const dx = player.x - a.x,
          dy = player.y - a.y;
        const reach = Math.min(1, entity.data.swoop / Math.max(0.1, Math.hypot(dx, dy)));
        entity.dive = {
          x: a.x + dx * reach,
          y: Math.max(entity.ground + 0.6, a.y + dy * reach),
          struck: false,
        };
      } else if (entity.fsm.attackTriggered) {
        if (entity.data.ranged) {
          const len = Math.max(0.1, Math.hypot(delta, player.y - a.y));
          this.projectiles.push({
            sourceId: a.id,
            x: a.x,
            y: a.y,
            vx: (delta / len) * entity.data.projectileSpeed,
            vy: ((player.y - a.y) / len) * entity.data.projectileSpeed,
            life: 3,
            damage: entity.data.damage,
          });
        } else
          onAttack(
            {
              // The blow reaches as far as the lunge carries it.
              x: a.x + entity.facing * (entity.data.range + entity.data.lunge) * 0.5,
              y: a.y,
              width: entity.data.range + entity.data.lunge,
              height: 2.2,
              damage: entity.data.damage,
              stagger: 0.22,
              force: 4,
              direction: entity.facing,
            },
            a,
          );
      }
    }
    for (const encounter of this.bosses) this.fight(encounter, dt, player, onAttack, plunging);
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (space) {
        // Out of the rooms on screen a shot is gone; in a wall it breaks.
        if (!space.open(p.x, p.y)) p.life = 0;
        else if (!space.blocked(p.x, p.y)) p.clear = true;
        else if (p.clear) p.life = 0;
        if (p.life <= 0) continue;
      }
      if (Math.abs(p.x - player.x) < 0.7 && Math.abs(p.y - player.y) < 0.9) {
        onAttack(
          {
            x: p.x,
            y: p.y,
            width: 0.7,
            height: 0.7,
            damage: p.damage,
            stagger: 0.2,
            force: 2,
            direction: Math.sign(p.vx),
          },
          this.entities.get(p.sourceId)?.actor ??
            this.encounter(p.sourceId)?.actor ??
            this.bosses[0]!.actor,
        );
        p.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }
  /** The dive of a flyer: a rush on its mark during the blow, a slow climb back after. */
  private swoop(
    entity: EnemyEntity,
    player: Combatant,
    dt: number,
    onAttack: (hit: Hitbox, source: Combatant) => void,
  ): void {
    const a = entity.actor,
      dive = entity.dive;
    if (dive && entity.fsm.state === 'ATTACK') {
      const k = Math.min(1, dt / Math.max(dt, STRIKE - entity.fsm.timer + dt));
      a.x += (dive.x - a.x) * k;
      a.y += (dive.y - a.y) * k;
      a.x = Math.max(entity.patrol[0], Math.min(entity.patrol[1], a.x));
      if (!dive.struck && touching(a, player)) {
        dive.struck = true;
        onAttack({ ...contact(a, player, entity.data.damage), stagger: 0.22, force: 5 }, a);
      }
      return;
    }
    entity.dive = null;
    if (a.y !== entity.altitude)
      a.y +=
        Math.sign(entity.altitude - a.y) * Math.min(Math.abs(entity.altitude - a.y), CLIMB * dt);
  }
  /** One boss fight: waking, moving within the arena, contact and its patterns' blows. */
  private fight(
    encounter: BossEncounter,
    dt: number,
    player: Combatant,
    onAttack: (hit: Hitbox, source: Combatant) => void,
    plunging: boolean,
  ): void {
    const { actor: boss, arena, data } = encounter;
    // Far from its arena, a boss simply waits (in a chamber above or below it, too).
    if (player.x < arena.left - 30 || player.x > arena.right + 30) return;
    if (Math.abs(player.y - data.spawn.y) > 12) return;
    if (!encounter.defeated && player.x > arena.trigger && player.x < arena.right)
      encounter.director.activate();
    const director = encounter.director,
      direction = Math.sign(player.x - boss.x) || -1;
    director.update(
      dt,
      boss.health,
      Math.abs(player.x - boss.x),
      direction,
      boss.stagger,
      player.x,
    );
    const kind = director.pattern.kind;
    // While its reflections stand, the true body holds its place among them.
    if (director.state === 'approach' && boss.stagger <= 0 && encounter.reflections.length === 0)
      boss.x += direction * director.speed * gaitStride(data.movement, director.timer) * dt;
    // A bound: the body arcs from where it left to its mark, then lands.
    if (director.trigger && kind === 'leap')
      encounter.leap = { from: boss.x, to: director.targets[0] ?? boss.x };
    const leap = encounter.leap;
    if (leap) {
      const flying = director.state === 'attack' && kind === 'leap';
      const t = flying ? Math.min(1, director.timer / LEAP_TIME) : 1;
      boss.x = leap.from + (leap.to - leap.from) * (t * t * (3 - 2 * t));
      if (t >= 1) {
        encounter.leap = null;
        this.land(encounter, player, onAttack);
      }
    }
    if (director.state === 'attack' && kind === 'charge') boss.x += director.direction * 13 * dt;
    // A blink lands where its mark was shown, then the boss faces Eidra again.
    if (director.trigger && kind === 'blink') {
      boss.x = director.targets[0] ?? boss.x;
      director.direction = Math.sign(player.x - boss.x) || -director.direction;
    }
    boss.x = Math.max(arena.roam[0], Math.min(arena.roam[1], boss.x));
    const vanished =
      (kind === 'blink' && director.state === 'windup' && director.timer > 0.2) ||
      encounter.leap !== null;
    if (
      boss.health > 0 &&
      !['dormant', 'dead'].includes(director.state) &&
      !vanished &&
      touching(boss, player) &&
      !(plunging && boss.y < player.y)
    )
      onAttack(contact(boss, player, data.contact), boss);
    this.signatures(encounter, dt, player, onAttack);
    if (director.trigger) {
      const pattern = director.pattern;
      if (pattern.kind === 'rain')
        for (const x of director.targets)
          this.projectiles.push({
            sourceId: boss.id,
            x,
            y: 11,
            vx: 0,
            vy: -15,
            life: 0.8,
            damage: pattern.damage,
          });
      else if (pattern.kind === 'slam' || pattern.kind === 'nova') this.waves(boss, pattern.damage);
      else if (pattern.kind === 'volley') {
        // A fan of shards aimed at Eidra from the boss's head.
        const originY = boss.y + boss.height * 0.3;
        const aim = Math.atan2(player.y - originY, player.x - boss.x);
        const half = (pattern.count - 1) / 2;
        for (let i = 0; i < pattern.count; i++) {
          const angle = aim + (i - half) * 0.22;
          this.projectiles.push({
            sourceId: boss.id,
            x: boss.x,
            y: originY,
            vx: Math.cos(angle) * 9,
            vy: Math.sin(angle) * 9,
            life: 2.5,
            damage: pattern.damage,
          });
        }
      } else if (pattern.kind === 'sweep' || pattern.kind === 'charge')
        onAttack(
          {
            x: boss.x + director.direction * pattern.range * 0.4,
            y: boss.y,
            width: pattern.range,
            height: boss.height * 0.95,
            damage: pattern.damage,
            stagger: 0.25,
            force: 6,
            direction: director.direction,
          },
          boss,
        );
    }
    if (director.state === 'attack' && kind === 'charge')
      onAttack(
        {
          x: boss.x,
          y: boss.y,
          width: 3,
          height: boss.height * 0.95,
          damage: director.pattern.damage,
          stagger: 0.3,
          force: 6,
          direction: director.direction,
        },
        boss,
      );
  }
  /** The end of a bound: a crushing impact and a wave racing out each way. */
  private land(
    encounter: BossEncounter,
    player: Combatant,
    onAttack: (hit: Hitbox, source: Combatant) => void,
  ): void {
    const boss = encounter.actor;
    const pattern = encounter.data.patterns.find((p) => p.kind === 'leap');
    const damage = pattern?.damage ?? encounter.data.contact;
    this.waves(boss, damage * 0.75);
    onAttack(
      {
        x: boss.x,
        y: boss.y,
        width: pattern?.range ?? 2.6,
        height: boss.height,
        damage,
        stagger: 0.3,
        force: 7,
        direction: Math.sign(player.x - boss.x) || 1,
      },
      boss,
    );
    encounter.director.direction = Math.sign(player.x - boss.x) || encounter.director.direction;
  }
  /** Two shock waves running along the floor from `x`, to be jumped. */
  private waves(source: Combatant, damage: number, x = source.x): void {
    for (const sign of [-1, 1])
      this.projectiles.push({
        sourceId: source.id,
        x,
        y: 0.45,
        vx: sign * 9,
        vy: 0,
        life: 3,
        damage,
      });
  }
  /**
   * The lasting part of the signature abilities: the planted standard, the gaze of
   * a command, the geysers of an eruption and the reflections of a mirror.
   */
  private signatures(
    encounter: BossEncounter,
    dt: number,
    player: Combatant,
    onAttack: (hit: Hitbox, source: Combatant) => void,
  ): void {
    const { actor: boss, director } = encounter;
    const pattern = director.pattern;
    const fighting = boss.health > 0 && !['dormant', 'dead'].includes(director.state);
    // Standard: driven into the floor beside its bearer, away from Eidra, it pulses
    // until it falls.
    if (director.trigger && pattern.kind === 'standard')
      encounter.standard = {
        x: Math.max(
          encounter.arena.roam[0],
          Math.min(encounter.arena.roam[1], boss.x - director.direction * (boss.radius + 0.6)),
        ),
        life: pattern.duration ?? 5,
        next: 0,
        damage: pattern.damage,
      };
    encounter.pulsed = false;
    const standard = encounter.standard;
    if (standard) {
      standard.life -= dt;
      standard.next -= dt;
      if (!fighting || standard.life <= 0) encounter.standard = null;
      else if (standard.next <= 0) {
        standard.next += STANDARD_INTERVAL;
        encounter.pulsed = true;
        this.waves(boss, standard.damage, standard.x);
      }
    }
    // Command: the first check marks where Eidra stands; every later one punishes
    // any movement with a shard falling straight onto her.
    encounter.punished = Math.max(0, encounter.punished - dt);
    if (pattern.kind !== 'command' || director.state !== 'attack') encounter.gaze = null;
    else if (director.trigger) {
      const gaze = encounter.gaze;
      if (gaze && Math.hypot(player.x - gaze.x, player.y - gaze.y) > GAZE_TOLERANCE) {
        encounter.punished = 0.35;
        this.projectiles.push({
          sourceId: boss.id,
          x: player.x,
          y: player.y + 6.5,
          vx: 0,
          vy: -26,
          life: 0.5,
          damage: pattern.damage,
        });
      }
      encounter.gaze = { x: player.x, y: player.y };
    }
    // Eruption: each pulse lights the next geyser of the line.
    if (director.trigger && pattern.kind === 'eruption') {
      const x = director.targets[director.waves - 1];
      if (x !== undefined)
        encounter.geysers.push({ x, life: 0.45, hit: false, damage: pattern.damage });
    }
    for (const geyser of encounter.geysers) {
      geyser.life -= dt;
      if (geyser.hit || Math.abs(player.x - geyser.x) > 0.75 || player.y > 3.2) continue;
      geyser.hit = true;
      onAttack(
        {
          x: player.x,
          y: player.y,
          width: 1.5,
          height: 3,
          damage: geyser.damage,
          stagger: 0.25,
          force: 5,
          direction: Math.sign(player.x - boss.x) || 1,
          unblockable: true,
        },
        boss,
      );
    }
    encounter.geysers = encounter.geysers.filter((g) => g.life > 0 && fighting);
    // Mirror: the body takes one of three places, its reflections the others.
    if (director.trigger && pattern.kind === 'mirror') {
      const slots = encounter.mirrorSlots();
      const real = encounter.nextMirror();
      boss.x = slots[real]!;
      director.direction = Math.sign(player.x - boss.x) || director.direction;
      encounter.reflections = slots
        .filter((_, i) => i !== real)
        .slice(0, pattern.count)
        .map((x, i) => ({
          actor: makeCombatant(`${boss.id}-reflet-${i}`, 1, x, boss.y, boss.radius, boss.height),
          life: pattern.duration ?? 6,
          next: 0.8 + i * 0.5,
          damage: pattern.damage,
        }));
    }
    // Striking the true body dispels its reflections.
    if (boss.health < encounter.lastHealth || !fighting) encounter.reflections = [];
    encounter.lastHealth = boss.health;
    for (const reflection of encounter.reflections) {
      const a = reflection.actor;
      reflection.life -= dt;
      reflection.next -= dt;
      if (reflection.next > 0 || a.health <= 0) continue;
      reflection.next = REFLECTION_SHOT;
      const originY = a.y + a.height * 0.3;
      const dx = player.x - a.x,
        dy = player.y - originY;
      const len = Math.max(0.1, Math.hypot(dx, dy));
      this.projectiles.push({
        sourceId: boss.id,
        x: a.x,
        y: originY,
        vx: (dx / len) * 8,
        vy: (dy / len) * 8,
        life: 2.5,
        damage: reflection.damage,
      });
    }
    encounter.reflections = encounter.reflections.filter((r) => r.life > 0 && r.actor.health > 0);
  }
  get actors(): Combatant[] {
    return [...this.entities.values()]
      .map((e) => e.actor)
      .concat(this.bosses.map((b) => b.actor))
      .concat(this.bosses.flatMap((b) => b.reflections.map((r) => r.actor)));
  }
  reset(): void {
    this.entities.clear();
    this.defeated.clear();
    this.projectiles = [];
    for (const encounter of this.bosses) encounter.reset();
  }
}

/** Contact boxes are smaller than the bodies so grazes and near jumps stay fair. */
const CONTACT_SCALE = 0.75;
/** Bodies overlap: shrunken hurtbox of one against the other's. */
function touching(a: Combatant, b: Combatant): boolean {
  return (
    Math.abs(a.x - b.x) < (a.radius + b.radius) * CONTACT_SCALE &&
    Math.abs(a.y - b.y) < ((a.height + b.height) / 2) * CONTACT_SCALE
  );
}
/** Contact damage pushes the player away from the body and cannot be parried. */
function contact(source: Combatant, player: Combatant, damage: number): Hitbox {
  return {
    x: player.x,
    y: player.y,
    width: 0.2,
    height: 0.2,
    damage,
    stagger: 0.12,
    force: 7,
    direction: Math.sign(player.x - source.x) || 1,
    unblockable: true,
  };
}

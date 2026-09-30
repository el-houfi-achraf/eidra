import { enemyData } from '../../game-data/enemies/roster';
import type { EnemyData } from '../../game-data/enemies/roster';
import { bossRoster } from '../../game-data/bosses/roster';
import type { BossData } from '../../game-data/bosses/schema';
import { EnemyFSM, STRIKE } from '../ai/EnemyFSM';
import { BossDirector } from '../bosses/BossDirector';
import { makeCombatant } from '../combat/CombatSystem';
import type { Combatant, Hitbox } from '../combat/CombatSystem';
import { arenas, chunks } from '../../game-data/zones/laboratory';
import type { Arena, ChunkData } from '../../game-data/zones/laboratory';
import { walkableSpan, clampToGates } from './Terrain';
import type { Solid } from './Terrain';
/** Solid (non-memory) slabs of the whole laboratory, used to bound enemy movement. */
const solids: Solid[] = chunks.flatMap((chunk) => chunk.platforms.filter((p) => !p.memory));
/**
 * A boss fight: the body, its director and whether it has fallen for good. Bosses
 * are not streamed with the sectors; they wait, dormant, in their arena.
 */
export class BossEncounter {
  readonly actor: Combatant;
  readonly arena: Arena;
  director: BossDirector;
  /** Fallen for good (persists in the save). */
  defeated = false;
  /** Its victory has been celebrated and rewarded. */
  rewarded = false;
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
}
export interface Projectile {
  sourceId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
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
        this.entities.set(spawn.id, {
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
  ): void {
    for (const entity of this.entities.values()) {
      const a = entity.actor,
        delta = player.x - a.x;
      entity.facing = Math.sign(delta) || 1;
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
      if (entity.fsm.state === 'CHASE')
        a.x += entity.facing * entity.data.speed * entity.fsm.pace * dt;
      // A lunge carries the body forward during the blow.
      if (entity.fsm.state === 'ATTACK' && entity.data.lunge > 0 && entity.fsm.timer <= STRIKE)
        a.x += entity.facing * (entity.data.lunge / STRIKE) * dt;
      if (entity.fsm.state === 'RETURN')
        a.x += Math.sign(entity.home - a.x) * entity.data.speed * dt;
      if (entity.fsm.state === 'PATROL') a.x += Math.sin(entity.fsm.timer * 2) * dt * 0.5;
      a.x = clampToGates(a.x + a.knockback * dt, entity.home, a.radius, gates, entity.patrol);
      if (entity.data.contact > 0 && touching(a, player) && !(plunging && a.y < player.y))
        onAttack(contact(a, player, entity.data.contact), a);
      if (entity.fsm.attackTriggered) {
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
  /** One boss fight: waking, moving within the arena, contact and its patterns' blows. */
  private fight(
    encounter: BossEncounter,
    dt: number,
    player: Combatant,
    onAttack: (hit: Hitbox, source: Combatant) => void,
    plunging: boolean,
  ): void {
    const { actor: boss, arena, data } = encounter;
    // Far from its arena, a boss simply waits.
    if (player.x < arena.left - 30 || player.x > arena.right + 30) return;
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
    if (director.state === 'approach' && boss.stagger <= 0)
      boss.x += direction * director.speed * dt;
    if (director.state === 'attack' && kind === 'charge') boss.x += director.direction * 13 * dt;
    // A blink lands where its mark was shown, then the boss faces Eidra again.
    if (director.trigger && kind === 'blink') {
      boss.x = director.targets[0] ?? boss.x;
      director.direction = Math.sign(player.x - boss.x) || -director.direction;
    }
    boss.x = Math.max(arena.roam[0], Math.min(arena.roam[1], boss.x));
    const vanished = kind === 'blink' && director.state === 'windup' && director.timer > 0.2;
    if (
      boss.health > 0 &&
      !['dormant', 'dead'].includes(director.state) &&
      !vanished &&
      touching(boss, player) &&
      !(plunging && boss.y < player.y)
    )
      onAttack(contact(boss, player, data.contact), boss);
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
      else if (pattern.kind === 'slam' || pattern.kind === 'nova')
        for (const sign of [-1, 1])
          this.projectiles.push({
            sourceId: boss.id,
            x: boss.x,
            y: 0.45,
            vx: sign * 9,
            vy: 0,
            life: 3,
            damage: pattern.damage,
          });
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
  get actors(): Combatant[] {
    return [...this.entities.values()].map((e) => e.actor).concat(this.bosses.map((b) => b.actor));
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

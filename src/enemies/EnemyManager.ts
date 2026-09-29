import { enemyData } from '../../game-data/enemies/roster';
import type { EnemyData } from '../../game-data/enemies/roster';
import { guardianData } from '../../game-data/bosses/guardian';
import { EnemyFSM } from '../ai/EnemyFSM';
import { BossDirector } from '../bosses/BossDirector';
import { makeCombatant } from '../combat/CombatSystem';
import type { Combatant, Hitbox } from '../combat/CombatSystem';
import { arenas, chunks } from '../../game-data/zones/laboratory';
import type { ChunkData } from '../../game-data/zones/laboratory';
import { walkableSpan, clampToGates } from './Terrain';
import type { Solid } from './Terrain';
/** Solid (non-memory) slabs of the whole laboratory, used to bound enemy movement. */
const solids: Solid[] = chunks.flatMap((chunk) => chunk.platforms.filter((p) => !p.memory));
const guardianArena = arenas.find((arena) => arena.guardian === 'faceless-guardian')!;
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
  readonly boss = makeCombatant('faceless-guardian', guardianData.health, 183, 2.4, 1.7, 4.8);
  director = new BossDirector();
  projectiles: Projectile[] = [];
  bossDefeated = false;
  bossRewarded = false;
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
      });
      if (a.health <= 0) {
        this.defeated.add(a.id);
        continue;
      }
      if (entity.fsm.state === 'CHASE') a.x += entity.facing * entity.data.speed * dt;
      if (entity.fsm.state === 'RETURN')
        a.x += Math.sign(entity.home - a.x) * entity.data.speed * dt;
      if (entity.fsm.state === 'PATROL') a.x += Math.sin(entity.fsm.timer * 2) * dt * 0.5;
      a.x = clampToGates(a.x + a.knockback * dt, entity.home, a.radius, gates, entity.patrol);
      if (entity.data.contact > 0 && touching(a, player))
        onAttack(contact(a, player, entity.data.contact), a);
      if (entity.fsm.attackTriggered) {
        if (entity.data.ranged) {
          const len = Math.max(0.1, Math.hypot(delta, player.y - a.y));
          this.projectiles.push({
            sourceId: a.id,
            x: a.x,
            y: a.y,
            vx: (delta / len) * 7,
            vy: ((player.y - a.y) / len) * 7,
            life: 3,
            damage: entity.data.damage,
          });
        } else
          onAttack(
            {
              x: a.x + entity.facing * entity.data.range * 0.5,
              y: a.y,
              width: entity.data.range,
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
    if (!this.bossDefeated && player.x > guardianArena.trigger) this.director.activate();
    const boss = this.boss,
      direction = Math.sign(player.x - boss.x) || -1;
    this.director.update(
      dt,
      boss.health,
      Math.abs(player.x - boss.x),
      direction,
      boss.stagger,
      player.x,
    );
    if (this.director.state === 'approach' && boss.stagger <= 0)
      boss.x += direction * (this.director.phase === 2 ? 3.2 : 2.4) * dt;
    if (this.director.state === 'attack' && this.director.pattern.id === 'charge')
      boss.x += this.director.direction * 13 * dt;
    boss.x = Math.max(guardianArena.roam[0], Math.min(guardianArena.roam[1], boss.x));
    if (
      boss.health > 0 &&
      !['dormant', 'dead'].includes(this.director.state) &&
      touching(boss, player)
    )
      onAttack(contact(boss, player, guardianData.contact), boss);
    if (this.director.trigger) {
      const pattern = this.director.pattern;
      if (pattern.id === 'rain')
        for (const x of this.director.targets)
          this.projectiles.push({
            sourceId: boss.id,
            x,
            y: 11,
            vx: 0,
            vy: -15,
            life: 0.8,
            damage: pattern.damage,
          });
      else if (pattern.id === 'slam')
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
      else
        onAttack(
          {
            x: boss.x + this.director.direction * pattern.range * 0.4,
            y: boss.y,
            width: pattern.range,
            height: 4.5,
            damage: pattern.damage,
            stagger: 0.25,
            force: 6,
            direction: this.director.direction,
          },
          boss,
        );
    }
    if (this.director.state === 'attack' && this.director.pattern.id === 'charge')
      onAttack(
        {
          x: boss.x,
          y: boss.y,
          width: 3,
          height: 4.5,
          damage: this.director.pattern.damage,
          stagger: 0.3,
          force: 6,
          direction: this.director.direction,
        },
        boss,
      );
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
          this.entities.get(p.sourceId)?.actor ?? boss,
        );
        p.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }
  get actors(): Combatant[] {
    return [...this.entities.values()].map((e) => e.actor).concat(this.boss);
  }
  reset(): void {
    this.entities.clear();
    this.defeated.clear();
    this.projectiles = [];
    this.director = new BossDirector();
    this.boss.health = this.bossDefeated ? 0 : guardianData.health;
    this.boss.x = 183;
    this.boss.invulnerable = 0;
    this.boss.stagger = 0;
    this.bossRewarded = this.bossDefeated;
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

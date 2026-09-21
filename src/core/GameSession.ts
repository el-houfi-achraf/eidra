import type { Scene } from '@babylonjs/core/scene';
import { PlayerController } from '../physics/PlayerController';
import { CombatSystem, makeCombatant, HurtboxSystem } from '../combat/CombatSystem';
import type { Hitbox, Combatant } from '../combat/CombatSystem';
import { AbilitySystem } from '../abilities/AbilitySystem';
import { EnemyManager } from '../enemies/EnemyManager';
import { NarrativeManager } from '../narrative/NarrativeManager';
import { QuestManager } from '../quests/QuestManager';
import { Inventory } from '../inventory/Inventory';
import { EventBus } from './EventBus';
import { InputAction } from '../player/InputAction';
import type { InputManager } from '../player/InputManager';
import type { World } from '../world/World';
import type { Settings } from '../config/settings';
import type { SaveData } from '../save/SaveManager';
import { checkpoints, landmarks, chunks, shortcuts } from '../../game-data/zones/laboratory';
import { abilityData } from '../../game-data/abilities/abilities';
import type { AbilityId } from '../../game-data/abilities/abilities';
import type { DialogueId } from '../../game-data/dialogue/story';
export interface SessionEffects {
  notice: (text: string) => void;
  burst: (x: number, y: number, kind: 'gold' | 'damage' | 'memory') => void;
  sound: (id: string, x?: number, y?: number) => void;
  shake: (value: number) => void;
  save: () => void;
  dialogue: () => void;
  death: () => void;
  ending: () => void;
}
export class GameSession {
  readonly player: PlayerController;
  readonly actor = makeCombatant('eidra', 100, 4, 1, 0.35, 1.7);
  readonly combat = new CombatSystem();
  readonly abilities = new AbilitySystem();
  readonly enemies = new EnemyManager();
  readonly narrative = new NarrativeManager();
  readonly quests = new QuestManager();
  readonly inventory = new Inventory();
  readonly events = new EventBus();
  readonly discovered = new Set<string>();
  checkpoint = 'awakening';
  playtime = 0;
  slot = 1;
  interaction = '';
  echoOpen = false;
  private chargeTime = 0;
  private wasCharging = false;
  private echoHitTime = 0;
  private zone = '';
  private hintTime = 0;
  private footstepTime = 0;
  private keeperDefeated = false;
  constructor(
    scene: Scene,
    readonly world: World,
    private fx: SessionEffects,
  ) {
    this.player = new PlayerController(scene);
  }
  newGame(slot: number): void {
    this.slot = slot;
    this.playtime = 0;
    this.checkpoint = 'awakening';
    this.abilities.unlocked.clear();
    this.narrative.flags.clear();
    this.narrative.memories.clear();
    this.inventory.collectibles.clear();
    this.inventory.shards = 0;
    this.inventory.healthUpgrades = 0;
    this.quests.completed.clear();
    this.discovered.clear();
    this.enemies.bossDefeated = false;
    this.keeperDefeated = false;
    this.respawn();
  }
  load(save: SaveData): void {
    this.slot = save.slot;
    this.playtime = save.playtime;
    this.checkpoint = save.checkpoint;
    this.abilities.unlocked = new Set(save.abilities);
    this.narrative.memories = new Set(save.memories);
    this.narrative.flags = new Set(save.flags);
    this.inventory.collectibles = new Set(save.collectibles);
    this.inventory.shards = save.shards;
    this.inventory.healthUpgrades = save.healthUpgrades;
    this.quests.completed = new Set(save.quests);
    this.discovered.clear();
    save.discoveredAreas.forEach((id) => this.discovered.add(id));
    this.enemies.bossDefeated = save.bosses.includes('faceless-guardian');
    this.keeperDefeated = save.bosses.includes('keeper');
    this.respawn();
    this.world.update(save.position.x, false, this.narrative.flags.has('echo-gate-open'), false);
    this.player.teleport(save.position.x, save.position.y);
    this.actor.health = Math.max(1, Math.min(this.actor.maxHealth, save.health));
  }
  snapshot(settings: Settings): SaveData {
    return {
      saveVersion: 2,
      slot: this.slot,
      savedAt: Date.now(),
      position: { x: this.player.position.x, y: this.player.position.y },
      checkpoint: this.checkpoint,
      abilities: [...this.abilities.unlocked],
      health: this.actor.health,
      healthUpgrades: this.inventory.healthUpgrades,
      collectibles: [...this.inventory.collectibles],
      shards: this.inventory.shards,
      bosses: [
        ...(this.enemies.bossDefeated ? ['faceless-guardian'] : []),
        ...(this.keeperDefeated ? ['keeper'] : []),
      ],
      quests: [...this.quests.completed],
      discoveredAreas: [...this.discovered],
      memories: [...this.narrative.memories],
      flags: [...this.narrative.flags],
      settings,
      playtime: this.playtime,
    };
  }
  respawn(): void {
    const point = checkpoints.find((c) => c.id === this.checkpoint) ?? checkpoints[0]!;
    this.enemies.reset();
    if (this.keeperDefeated) this.enemies.defeated.add('keeper');
    this.abilities.resetTransient();
    this.combat.reset();
    this.chargeTime = 0;
    this.wasCharging = false;
    this.narrative.active = null;
    this.actor.maxHealth = 100 + this.inventory.healthUpgrades * 20;
    this.actor.health = this.actor.maxHealth;
    this.actor.invulnerable = 1;
    this.actor.stagger = 0;
    this.actor.knockback = 0;
    this.world.update(point.x, false, this.narrative.flags.has('echo-gate-open'), false);
    this.player.teleport(point.x, 1.2);
    this.actor.x = point.x;
    this.actor.y = 1.2;
  }
  update(dt: number, input: InputManager, settings: Settings): void {
    this.playtime += dt;
    this.hintTime = Math.max(0, this.hintTime - dt);
    this.echoHitTime = Math.max(0, this.echoHitTime - dt);
    const p = this.player;
    this.combat.update(dt, [this.actor, ...this.enemies.actors]);
    const jump = input.consume(InputAction.Jump),
      dash = input.consume(InputAction.Dash);
    p.update(
      dt,
      {
        axis: this.actor.stagger > 0 ? 0 : input.movement,
        jump,
        jumpHeld: input.held(InputAction.Jump),
        dash: dash && this.actor.stagger <= 0,
        walk: input.held(InputAction.Walk),
      },
      this.abilities.unlocked.has('dash'),
      this.abilities.unlocked.has('double-jump'),
      this.actor.knockback,
    );
    this.actor.x = p.position.x;
    this.actor.y = p.position.y;
    if (dash && p.motion.dashTime > 0) {
      this.fx.sound('dash');
      this.fx.burst(this.actor.x, this.actor.y, 'memory');
    }
    if (jump && p.motion.vy > 0) this.fx.sound('jump');
    this.footstepTime -= dt;
    if (p.motion.grounded && Math.abs(p.motion.vx) > 1 && this.footstepTime <= 0) {
      this.fx.sound('footstep');
      this.footstepTime = 0.3;
    }
    this.combat.dodge.apply(this.actor, p.motion.dashTime > 0.025);
    if (input.consume(InputAction.Parry) && this.actor.stagger <= 0 && this.combat.parry.start())
      this.fx.sound('parry');
    if (input.consume(InputAction.Attack) && this.actor.stagger <= 0)
      this.attack(p.motion.dashTime > 0 ? 'dash' : p.motion.grounded ? 'light' : 'aerial');
    const chargePressed = input.consume(InputAction.Charge);
    const charging = input.held(InputAction.Charge) || chargePressed;
    if (charging) this.chargeTime = Math.min(1.2, this.chargeTime + dt);
    if (!charging && this.wasCharging) {
      if (this.actor.stagger <= 0) this.attack(this.chargeTime > 0.45 ? 'charged' : 'light');
      this.chargeTime = 0;
    }
    this.wasCharging = charging;
    if (input.consume(InputAction.Remanence)) {
      if (this.abilities.toggleRemanence()) this.fx.sound('memory');
      else this.fx.notice('Cette mémoire attend d’être retrouvée.');
    }
    if (!settings.memoryToggle && !input.held(InputAction.Remanence))
      this.abilities.remanence = false;
    if (input.consume(InputAction.Echo)) {
      if (this.abilities.createEcho()) this.fx.sound('memory');
      else this.fx.notice('Memory Step nécessite une trace, 25 de mémoire et un temps de repos.');
    }
    this.abilities.update(dt, {
      x: this.actor.x,
      y: this.actor.y,
      facing: p.motion.facing,
      attacking: this.combat.active,
    });
    const echo = this.abilities.echo;
    this.echoOpen =
      this.narrative.flags.has('echo-gate-open') ||
      Math.abs(this.actor.x - 130) < 1.3 ||
      (echo !== null && Math.abs(echo.x - 130) < 1.3 && echo.y < 2);
    if (this.echoOpen && this.actor.x > 142.5 && !this.narrative.flags.has('echo-gate-open')) {
      this.narrative.flags.add('echo-gate-open');
      this.fx.notice('Le contrepoids se souvient. Le passage reste ouvert.');
      this.fx.save();
    }
    this.world.update(this.actor.x, this.abilities.remanence, this.echoOpen, this.bossActive);
    this.enemies.sync([...this.world.stream.loaded.values()].map((c) => c.data));
    this.enemies.update(dt, this.actor, (hit, source) => this.takeHit(hit, source, settings));
    if (this.combat.active) {
      const hit = this.combat.strike(this.actor, p.motion.facing);
      for (const enemy of this.enemies.actors) {
        if (enemy.id === 'faceless-guardian' && !this.bossActive) continue;
        if (this.combat.hitboxes.test(hit, enemy)) this.hurtEnemy(enemy, hit);
      }
    }
    if (echo?.attacking && this.echoHitTime === 0) {
      this.echoHitTime = 0.3;
      const hit = { ...this.combat.strike({ ...this.actor, ...echo }, echo.facing), damage: 6 };
      for (const enemy of this.enemies.actors)
        if (new HurtboxSystem().overlaps(hit, enemy)) this.hurtEnemy(enemy, hit);
    }
    for (const entity of this.enemies.entities.values())
      if (entity.actor.health <= 0 && !entity.rewarded) {
        entity.rewarded = true;
        this.inventory.shards += entity.data.drops;
        this.fx.burst(entity.actor.x, entity.actor.y, 'gold');
        if (entity.kind === 'keeper') {
          this.keeperDefeated = true;
          this.fx.notice('Le dernier ordre s’éteint.');
          this.fx.save();
        }
      }
    if (this.enemies.boss.health <= 0 && !this.enemies.bossRewarded) {
      this.enemies.bossRewarded = true;
      this.enemies.bossDefeated = true;
      this.narrative.flags.add('boss-defeated');
      this.events.emit('BOSS_DEFEATED', { id: 'faceless-guardian' });
      this.inventory.shards += 20;
      this.fx.burst(this.enemies.boss.x, 2, 'gold');
      this.fx.notice('L’ORDRE EST ROMPU');
      this.fx.sound('victory');
      this.fx.save();
    }
    this.updateProgression(input);
    if (this.actor.y < -5) {
      this.takeHit(
        {
          x: this.actor.x,
          y: this.actor.y,
          width: 2,
          height: 2,
          damage: 20,
          stagger: 0,
          force: 0,
          direction: 0,
        },
        this.actor,
        settings,
        true,
      );
      if (this.actor.health > 0) {
        const safe =
          this.actor.x > 88 && this.actor.x < 109
            ? 84
            : (checkpoints.find((c) => c.id === this.checkpoint)?.x ?? 7);
        this.player.teleport(safe, 1.4);
      }
    }
    if (this.actor.health <= 0) {
      this.events.emit('PLAYER_DIED', undefined);
      this.fx.death();
    }
  }
  private attack(kind: 'light' | 'charged' | 'aerial' | 'dash'): void {
    if (this.combat.begin(kind)) this.fx.sound(kind === 'charged' ? 'heavy' : 'attack');
  }
  private hurtEnemy(enemy: Combatant, hit: Hitbox): void {
    const dealt = this.combat.damage.apply(
      enemy,
      enemy.id === 'faceless-guardian' ? { ...hit, stagger: 0 } : hit,
    );
    if (dealt > 0) {
      this.fx.burst(enemy.x, enemy.y, 'damage');
      this.fx.sound('hit', enemy.x, enemy.y);
      this.fx.shake(0.22);
    }
  }
  private takeHit(hit: Hitbox, source: Combatant, settings: Settings, fall = false): void {
    if (!fall && !new HurtboxSystem().overlaps(hit, this.actor)) return;
    if (!fall && this.combat.parry.tryParry(source)) {
      this.fx.burst(this.actor.x, this.actor.y, 'gold');
      this.fx.sound('parry');
      return;
    }
    if (fall) this.actor.invulnerable = 0;
    const dealt = this.combat.damage.apply(
      this.actor,
      { ...hit, damage: hit.damage * (settings.assist ? 0.45 : 1) },
      0.8,
    );
    if (dealt > 0) {
      this.fx.burst(this.actor.x, this.actor.y, 'damage');
      this.fx.shake(0.6);
      this.fx.sound('hurt');
      this.events.emit('PLAYER_DAMAGED', { amount: dealt, health: this.actor.health });
    }
  }
  private updateProgression(input: InputManager): void {
    const x = this.actor.x,
      y = this.actor.y;
    const zone = chunks.find((c) => x >= c.start && x < c.end);
    if (zone) {
      this.discovered.add(zone.id);
      if (zone.id !== this.zone) {
        this.zone = zone.id;
        this.fx.notice(zone.name);
      }
    }
    this.interaction = '';
    for (const point of checkpoints)
      if (Math.abs(x - point.x) < 2 && y < 2.5) {
        this.interaction = `${input.label(InputAction.Interact)} · S’ancrer — restaurer et sauvegarder`;
        if (input.consume(InputAction.Interact)) {
          this.checkpoint = point.id;
          this.actor.health = this.actor.maxHealth;
          this.abilities.energy = 100;
          this.events.emit('CHECKPOINT_ACTIVATED', { id: point.id });
          this.fx.burst(x, y, 'memory');
          this.fx.sound('save');
          this.fx.save();
        }
      }
    for (const marker of landmarks) {
      if (
        Math.hypot(x - marker.x, y - marker.y) > 1.8 ||
        this.inventory.collectibles.has(marker.id)
      )
        continue;
      if (marker.kind === 'ability') {
        const id = marker.id as AbilityId;
        this.abilities.unlock(id);
        this.inventory.collect(marker.id, 0);
        this.events.emit('ABILITY_UNLOCKED', { id });
        this.fx.notice(`${abilityData[id].name.toUpperCase()} — ${abilityData[id].description}`);
        this.fx.burst(x, y, 'memory');
        this.fx.sound('memory');
        this.fx.save();
      }
      if (marker.kind === 'npc') {
        this.interaction = `${input.label(InputAction.Interact)} · Parler à Mira`;
        if (input.consume(InputAction.Interact))
          this.dialogue(this.narrative.flags.has('met-mira') ? 'miraReturn' : 'mira');
      }
      if (marker.kind === 'memory') {
        this.interaction = `${input.label(InputAction.Interact)} · Retrouver ${marker.label}`;
        if (input.consume(InputAction.Interact)) {
          this.inventory.collect(marker.id, 3);
          this.narrative.remember(marker.id);
          this.events.emit('MEMORY_DISCOVERED', { id: marker.id });
          this.dialogue(marker.id);
          this.fx.sound('memory');
          this.fx.save();
        }
      }
    }
    for (const passage of shortcuts) {
      if (Math.hypot(x - passage.x, y - passage.y) > 1.8) continue;
      const unlocked = this.narrative.flags.has(passage.requires);
      this.interaction = unlocked
        ? `${input.label(InputAction.Interact)} · ${passage.label}`
        : 'Conduit scellé — un contrepoids retient la porte';
      if (unlocked && input.consume(InputAction.Interact)) {
        this.world.update(passage.toX, this.abilities.remanence, true, false);
        this.player.teleport(passage.toX, passage.toY);
        this.fx.sound('memory');
        this.fx.notice(passage.label);
        break;
      }
    }
    if (x > 125 && x < 140 && this.hintTime === 0 && !this.narrative.flags.has('echo-gate-open')) {
      this.fx.notice(
        'Restez quelques secondes sur le sceau, puis créez votre Écho avec ' +
          input.label(InputAction.Echo) +
          '.',
      );
      this.hintTime = 12;
    }
    if (x > 163 && !this.narrative.flags.has('heard-sael')) this.dialogue('sael');
    if (x > 195 && this.enemies.bossDefeated) {
      this.dialogue('aftermath');
      this.fx.ending();
    }
    for (const id of this.quests.update(this.narrative.flags))
      this.events.emit('QUEST_UPDATED', { id });
  }
  dialogue(id: DialogueId): void {
    this.narrative.start(id);
    this.fx.dialogue();
  }
  get zoneName(): string {
    return chunks.find((c) => c.id === this.zone)?.name ?? 'CHAMBRE D’ÉVEIL';
  }
  get bossActive(): boolean {
    return !this.enemies.bossDefeated && !['dormant', 'dead'].includes(this.enemies.director.state);
  }
  dispose(): void {
    this.player.dispose();
    this.events.clear();
  }
}

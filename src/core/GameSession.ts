import type { Scene } from '@babylonjs/core/scene';
import { PlayerController } from '../physics/PlayerController';
import { CombatSystem, makeCombatant, HurtboxSystem } from '../combat/CombatSystem';
import type { Hitbox, Combatant, AttackKind } from '../combat/CombatSystem';
import { AbilitySystem } from '../abilities/AbilitySystem';
import { FocusSystem } from '../abilities/FocusSystem';
import { EnemyManager } from '../enemies/EnemyManager';
import { NarrativeManager } from '../narrative/NarrativeManager';
import { QuestManager } from '../quests/QuestManager';
import { Inventory } from '../inventory/Inventory';
import { EventBus } from './EventBus';
import { InputAction } from '../player/InputAction';
import { TutorialDirector } from '../quests/TutorialDirector';
import { ArenaDirector } from '../bosses/ArenaDirector';
import { StageProgress } from '../quests/StageProgress';
import type { HintAction, TutorialHint } from '../../game-data/quests/tutorial';
import type { InputManager } from '../player/InputManager';
import type { World } from '../world/World';
import type { Settings } from '../config/settings';
import type { SaveData } from '../save/SaveManager';
import {
  checkpoints,
  landmarks,
  chunks,
  shortcuts,
  gates,
  progressGates,
  stageGate,
  arenas,
  pits,
  route,
} from '../../game-data/zones/laboratory';
import { focusData } from '../../game-data/abilities/abilities';
import type { AbilityId } from '../../game-data/abilities/abilities';
import type { DialogueId } from '../../game-data/dialogue/story';
import type { BossEncounter } from '../enemies/EnemyManager';
import { scorches } from '../combat/Hazards';
export type BurstKind = 'gold' | 'damage' | 'memory' | 'dust' | 'heal';
export type TitleKind = 'area' | 'boss' | 'victory';
export interface SessionEffects {
  notice: (text: string) => void;
  burst: (x: number, y: number, kind: BurstKind) => void;
  sound: (id: string, x?: number, y?: number) => void;
  shake: (value: number) => void;
  save: () => void;
  dialogue: () => void;
  death: () => void;
  ending: () => void;
  /** Large cinematic card: a newly entered area, a boss introduction or a victory. */
  title: (kind: TitleKind, title: string, subtitle: string) => void;
  unlock: (id: AbilityId) => void;
  altar: () => void;
}
export class GameSession {
  readonly player: PlayerController;
  readonly actor = makeCombatant('eidra', 100, 4, 1, 0.35, 1.7);
  readonly combat = new CombatSystem();
  readonly abilities = new AbilitySystem();
  readonly focus = new FocusSystem();
  readonly tutorial = new TutorialDirector();
  readonly arenas = new ArenaDirector();
  readonly stages = new StageProgress();
  /** Sealed exits already announced; forgotten once Eidra walks away. */
  private warned = new Set<string>();
  /** Contextual prompt to display, if any. */
  hint: TutorialHint | null = null;
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
  private footstepTime = 0;
  /** Clock of the ember vents, seconds of play. */
  hazardTime = 0;
  /** Arena guardians fought as ordinary enemies (the elites), fallen for good. */
  private fallen = new Set<string>();
  /** Bosses whose introduction has been announced since the last respawn. */
  private introduced = new Set<string>();
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
    for (const encounter of this.enemies.bosses) encounter.defeated = false;
    this.fallen.clear();
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
    for (const encounter of this.enemies.bosses)
      encounter.defeated = save.bosses.includes(encounter.data.id);
    this.fallen = new Set(
      save.bosses.filter(
        (id) => !this.enemies.encounter(id) && arenas.some((a) => a.guardian === id),
      ),
    );
    this.respawn();
    this.world.update(save.position.x, false, this.relocate(save.position.x));
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
        ...this.enemies.bosses.filter((b) => b.defeated).map((b) => b.data.id),
        ...this.fallen,
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
    for (const id of this.fallen) this.enemies.defeated.add(id);
    this.arenas.reset();
    this.warned.clear();
    this.echoOpen = false;
    this.abilities.resetTransient();
    this.combat.reset();
    this.chargeTime = 0;
    this.wasCharging = false;
    this.narrative.active = null;
    this.actor.maxHealth = this.inventory.maxHealth;
    this.focus.reset();
    this.introduced.clear();
    this.actor.health = this.actor.maxHealth;
    this.actor.invulnerable = 1;
    this.actor.stagger = 0;
    this.actor.knockback = 0;
    this.world.update(point.x, false, this.relocate(point.x));
    this.player.teleport(point.x, 1.2);
    this.actor.x = point.x;
    this.actor.y = 1.2;
  }
  update(dt: number, input: InputManager, settings: Settings): void {
    // Hit-stop: the world holds its breath for a few frames when a blow lands.
    // Pressed inputs stay buffered and are consumed on the next live step.
    if (this.combat.hitStop.freeze(dt)) return;
    this.playtime += dt;
    this.echoHitTime = Math.max(0, this.echoHitTime - dt);
    const p = this.player;
    this.combat.update(dt, [this.actor, ...this.enemies.actors]);
    const jump = input.consume(InputAction.Jump),
      dash = input.consume(InputAction.Dash);
    if (jump || dash) this.focus.interrupt();
    p.update(
      dt,
      {
        axis: this.actor.stagger > 0 || this.focus.channeling ? 0 : input.movement,
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
    if (p.motion.grounded && Math.abs(p.motion.vx) > 2) this.learn('move');
    if (dash && p.motion.dashTime > 0) {
      this.learn('dash');
      this.fx.sound('dash');
      this.fx.burst(this.actor.x, this.actor.y, 'memory');
    }
    if (jump && p.motion.vy > 0) {
      this.learn('jump');
      // The Seconde impulsion: a second jump in the air.
      if (p.motion.jumps >= 2) {
        this.learn('double');
        this.fx.burst(this.actor.x, this.actor.y - 0.6, 'memory');
      }
      this.fx.sound('jump');
    }
    this.footstepTime -= dt;
    if (p.motion.grounded && Math.abs(p.motion.vx) > 1 && this.footstepTime <= 0) {
      this.fx.sound('footstep');
      this.footstepTime = 0.3;
    }
    this.combat.dodge.apply(this.actor, p.motion.dashTime > 0.025);
    if (input.consume(InputAction.Parry) && this.actor.stagger <= 0 && this.combat.parry.start()) {
      this.learn('parry');
      this.fx.sound('parry');
    }
    // A press during recovery is remembered briefly, so combos chain without dropped inputs.
    if (input.consume(InputAction.Attack)) this.combat.attackBuffer.press();
    if (this.combat.attackBuffer.take(this.actor.stagger <= 0 && this.combat.cooldown === 0))
      this.attack(
        p.motion.dashTime > 0
          ? 'dash'
          : p.motion.grounded
            ? 'light'
            : input.held(InputAction.Down)
              ? 'down'
              : 'aerial',
      );
    const chargePressed = input.consume(InputAction.Charge);
    const charging = input.held(InputAction.Charge) || chargePressed;
    if (charging) this.chargeTime = Math.min(1.2, this.chargeTime + dt);
    if (!charging && this.wasCharging) {
      if (this.actor.stagger <= 0) this.attack(this.chargeTime > 0.45 ? 'charged' : 'light');
      this.chargeTime = 0;
    }
    this.wasCharging = charging;
    if (input.consume(InputAction.Remanence)) {
      if (this.abilities.toggleRemanence()) {
        if (this.abilities.remanence) this.learn('remanence');
        this.fx.sound('memory');
      } else this.fx.notice('Cette mémoire attend d’être retrouvée.');
    }
    if (!settings.memoryToggle && !input.held(InputAction.Remanence))
      this.abilities.remanence = false;
    if (input.consume(InputAction.Echo)) {
      if (this.abilities.createEcho()) {
        this.learn('echo');
        this.fx.sound('memory');
      } else this.fx.notice('Memory Step nécessite une trace, 25 de mémoire et un temps de repos.');
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
    // Recueillement: grounded and idle.
    const healed = this.focus.update(
      dt,
      input.held(InputAction.Heal),
      p.motion.grounded &&
        !this.combat.attacking &&
        p.motion.dashTime === 0 &&
        this.actor.stagger <= 0 &&
        this.chargeTime === 0,
      this.actor,
    );
    if (healed > 0) {
      this.learn('heal');
      this.events.emit('PLAYER_HEALED', { amount: healed, health: this.actor.health });
      this.fx.burst(this.actor.x, this.actor.y, 'heal');
      this.fx.sound('save');
    }
    // Ember vents burst on the session clock, so visuals and damage agree.
    this.hazardTime += dt;
    for (const chunk of this.world.stream.loaded.values())
      for (const vent of chunk.data.hazards)
        if (scorches(vent, this.hazardTime, this.actor.x, this.actor.y, this.actor.radius))
          this.takeHit(
            {
              x: this.actor.x,
              y: this.actor.y,
              width: 0.2,
              height: 0.2,
              damage: vent.damage,
              stagger: 0.2,
              force: 8,
              direction: Math.sign(this.actor.x - vent.x) || 1,
              unblockable: true,
            },
            this.actor,
            settings,
          );
    const closed = this.closedGates();
    this.world.update(this.actor.x, this.abilities.remanence, closed);
    this.enemies.sync([...this.world.stream.loaded.values()].map((c) => c.data));
    this.enemies.update(
      dt,
      this.actor,
      (hit, source) => this.takeHit(hit, source, settings),
      gates.filter((gate) => closed.has(gate.id)).map((gate) => gate.x),
      // From the press, a plunge takes priority over the body it lands on (pogo).
      this.combat.attacking && this.combat.attackKind === 'down',
    );
    if (this.combat.active) {
      const hit = this.combat.strike(this.actor, p.motion.facing);
      let bounced = false;
      for (const enemy of this.enemies.actors) {
        if (enemy.health <= 0) continue;
        const boss = this.enemies.encounter(enemy.id);
        if (boss && !boss.active) continue;
        if (!this.combat.hitboxes.test(hit, enemy)) continue;
        if (!boss?.director.armored) this.hurtEnemy(enemy, hit, true);
        // Pogo: a downward strike that connects springs Eidra back into the air.
        if (this.combat.attackKind === 'down' && !bounced) {
          bounced = true;
          p.motion.bounce();
          this.learn('down');
          this.fx.sound('jump');
        }
      }
    }
    if (echo?.attacking && this.echoHitTime === 0) {
      this.echoHitTime = 0.3;
      const hit = { ...this.combat.strike({ ...this.actor, ...echo }, echo.facing), damage: 6 };
      for (const enemy of this.enemies.actors) {
        const boss = this.enemies.encounter(enemy.id);
        if (
          new HurtboxSystem().overlaps(hit, enemy) &&
          (!boss || (boss.active && !boss.director.armored))
        )
          this.hurtEnemy(enemy, hit, false);
      }
    }
    for (const entity of this.enemies.entities.values())
      if (entity.actor.health <= 0 && !entity.rewarded) {
        entity.rewarded = true;
        this.inventory.shards += entity.data.drops;
        this.combat.hitStop.trigger(0.09);
        this.fx.burst(entity.actor.x, entity.actor.y, 'gold');
        this.events.emit('ENEMY_DEFEATED', {
          id: entity.actor.id,
          x: entity.actor.x,
          y: entity.actor.y,
          shards: entity.data.drops,
        });
        // An elite guarding an arena falls for good (saved with the bosses).
        const arena = arenas.find((a) => a.guardian === entity.actor.id);
        if (arena) {
          this.fallen.add(entity.actor.id);
          this.narrative.flags.add(`defeated:${entity.actor.id}`);
          this.fx.title('victory', arena.victory, `${entity.data.name} vaincu`);
          this.fx.save();
        }
      }
    for (const encounter of this.enemies.bosses) this.announce(encounter);
    // Guarded chambers: sealing and clearing are announced; gates follow `closedGates`.
    const arena = this.arenas.update(this.actor.x, this.isDefeated);
    if (arena?.type === 'sealed') {
      // Bosses announce themselves; elites get the arena's title card.
      if (!this.enemies.encounter(arena.arena.guardian))
        this.fx.title('boss', arena.arena.name, arena.arena.subtitle);
      this.fx.notice('Le seuil se referme derrière vous.');
      this.fx.shake(0.6);
      this.fx.sound('heavy');
    }
    if (arena?.type === 'cleared') {
      this.fx.notice('Le passage s’ouvre.');
      this.fx.sound('save');
    }
    // Stages: a sector's exit opens once its guardians have fallen, and stays open (saved).
    const down = (id: string): boolean => this.enemies.defeated.has(id);
    for (const stage of this.stages.clear(this.narrative.flags, down)) {
      this.fx.notice(`${stage.name} : le passage s’ouvre.`);
      this.fx.sound('save');
      this.fx.save();
    }
    for (const stage of this.stages.sealed(this.narrative.flags)) {
      const id = stageGate(stage.id);
      const ahead = stage.gate - this.actor.x;
      if (!this.stages.beyond(id) && ahead > 0 && ahead < 3.5 && !this.warned.has(id)) {
        this.warned.add(id);
        const left = this.stages.remaining(stage, down);
        this.fx.notice(
          `Passage scellé : ${left} gardien${left > 1 ? 's' : ''} du secteur à vaincre.`,
        );
      }
      if (ahead > 6 || ahead < -1) this.warned.delete(id);
    }
    this.updateProgression(input);
    this.hint = this.tutorial.update({
      x: this.actor.x,
      abilities: this.abilities.unlocked,
      flags: this.narrative.flags,
      wounded:
        this.actor.health < this.actor.maxHealth * 0.6 &&
        this.focus.resonance >= this.focus.data.cost,
    });
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
        const pit = pits.find((p) => this.actor.x > p.from && this.actor.x < p.to);
        const safe = pit?.safe ?? checkpoints.find((c) => c.id === this.checkpoint)?.x ?? 7;
        this.player.teleport(safe, 1.4);
      }
    }
    if (this.actor.health <= 0) {
      this.events.emit('PLAYER_DIED', undefined);
      this.fx.death();
    }
  }
  /** Introduction, phase roars and victory of a boss fight. */
  private announce(encounter: BossEncounter): void {
    const { data, director, actor } = encounter;
    if (director.state === 'intro' && !this.introduced.has(data.id)) {
      this.introduced.add(data.id);
      this.fx.title('boss', data.name, data.subtitle);
      this.fx.shake(0.5);
    }
    if (director.state === 'transition' && director.timer === 0) {
      this.fx.shake(0.9);
      this.fx.sound('heavy', actor.x, actor.y);
      this.fx.burst(actor.x, 3, 'damage');
    }
    if (actor.health <= 0 && !encounter.rewarded) {
      encounter.rewarded = true;
      encounter.defeated = true;
      // `boss-defeated` completes Act I's quest; every boss also leaves its own flag.
      if (data.id === 'faceless-guardian') this.narrative.flags.add('boss-defeated');
      this.narrative.flags.add(`defeated:${data.id}`);
      this.events.emit('BOSS_DEFEATED', { id: data.id });
      const shards = Math.round(data.health / 20);
      this.events.emit('ENEMY_DEFEATED', { id: data.id, x: actor.x, y: 2, shards });
      this.inventory.shards += shards;
      this.combat.hitStop.trigger(0.2);
      this.fx.burst(actor.x, 2, 'gold');
      const arena = encounter.arena;
      this.fx.title('victory', arena.victory, `${data.name} vaincu`);
      this.fx.sound('victory');
      this.fx.save();
    }
  }
  private learn(action: HintAction): void {
    this.tutorial.perform(action, this.narrative.flags);
  }
  private attack(kind: AttackKind): void {
    this.focus.interrupt();
    if (!this.combat.begin(kind)) return;
    this.learn('attack');
    this.fx.sound(kind === 'charged' || this.combat.empowered ? 'heavy' : 'attack');
  }
  private hurtEnemy(enemy: Combatant, hit: Hitbox, byPlayer: boolean): void {
    const dealt = this.combat.damage.apply(
      enemy,
      enemy.id === 'faceless-guardian' ? { ...hit, stagger: 0 } : hit,
    );
    if (dealt > 0) {
      const finisher = byPlayer && this.combat.finisher;
      this.events.emit('ENEMY_DAMAGED', {
        id: enemy.id,
        amount: dealt,
        x: enemy.x,
        y: enemy.y + enemy.height / 2,
        finisher,
      });
      if (byPlayer) {
        this.focus.gain(focusData.gainPerHit);
        this.combat.hitStop.trigger(finisher ? 0.085 : 0.05);
      }
      this.fx.burst(enemy.x, enemy.y, 'damage');
      this.fx.sound('hit', enemy.x, enemy.y);
      this.fx.shake(finisher ? 0.4 : 0.22);
    }
  }
  private takeHit(hit: Hitbox, source: Combatant, settings: Settings, fall = false): void {
    if (!fall && !new HurtboxSystem().overlaps(hit, this.actor)) return;
    if (!fall && !hit.unblockable && this.combat.parry.tryParry(source)) {
      this.focus.gain(focusData.gainOnParry);
      this.combat.hitStop.trigger(0.12);
      this.events.emit('PARRIED', { x: this.actor.x, y: this.actor.y });
      this.fx.burst(this.actor.x, this.actor.y, 'gold');
      this.fx.sound('parry');
      this.fx.shake(0.35);
      return;
    }
    if (fall) this.actor.invulnerable = 0;
    const dealt = this.combat.damage.apply(
      this.actor,
      { ...hit, damage: hit.damage * (settings.assist ? 0.45 : 1) },
      0.8,
    );
    if (dealt > 0) {
      this.focus.interrupt();
      this.combat.hitStop.trigger(0.07);
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
      const first = !this.discovered.has(zone.id);
      this.discovered.add(zone.id);
      if (zone.id !== this.zone) {
        this.zone = zone.id;
        this.fx.title(
          'area',
          zone.name,
          first ? 'Nouvelle zone découverte' : 'Laboratoire de l’éveil',
        );
      }
    }
    this.interaction = '';
    for (const point of checkpoints)
      if (Math.abs(x - point.x) < 2 && y < 2.5) {
        const current = point.id === this.checkpoint;
        this.interaction = current
          ? `${input.label(InputAction.Interact)} · Autel de l’ancrage — repos et offrandes`
          : `${input.label(InputAction.Interact)} · S’ancrer — restaurer et sauvegarder`;
        if (input.consume(InputAction.Interact)) {
          this.checkpoint = point.id;
          this.actor.health = this.actor.maxHealth;
          this.abilities.energy = 100;
          this.events.emit('CHECKPOINT_ACTIVATED', { id: point.id });
          this.fx.burst(x, y, 'memory');
          this.fx.sound('save');
          this.fx.save();
          if (current) this.fx.altar();
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
        this.fx.unlock(id);
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
        this.world.update(passage.toX, this.abilities.remanence, this.relocate(passage.toX));
        this.player.teleport(passage.toX, passage.toY);
        this.fx.sound('memory');
        this.fx.notice(passage.label);
        break;
      }
    }
    const flags = this.narrative.flags;
    if (x > 163 && x < 197 && !flags.has('heard-sael')) this.dialogue('sael');
    // Act I closes on Mira's farewell; the route then opens onto Act II.
    if (x > route.aftermath && this.defeated('faceless-guardian') && !flags.has('slice-complete'))
      this.dialogue('aftermath');
    else if (x > route.act2.x && flags.has('slice-complete') && !flags.has('act-2')) {
      flags.add('act-2');
      this.fx.title('victory', route.act2.title, route.act2.subtitle);
      this.fx.sound('memory');
    }
    if (x > 208 && x < 240 && !flags.has('heard-nhalis')) this.dialogue('nhalis');
    if (x > 368 && x < route.finale.x && !flags.has('heard-ilyra')) this.dialogue('ilyra');
    if (x > route.finale.x && this.defeated(route.finale.boss) && !flags.has('act2-complete')) {
      this.dialogue('epilogue');
      this.fx.ending();
    }
    for (const id of this.quests.update(this.narrative.flags))
      this.events.emit('QUEST_UPDATED', { id });
  }
  /** Anchor offering: spends shards for a permanent vitality upgrade. */
  offer(): boolean {
    if (!this.inventory.offer()) return false;
    this.actor.maxHealth = this.inventory.maxHealth;
    this.actor.health = this.actor.maxHealth;
    this.events.emit('OFFERING_MADE', {
      upgrades: this.inventory.healthUpgrades,
      maxHealth: this.actor.maxHealth,
    });
    this.fx.burst(this.actor.x, this.actor.y, 'heal');
    this.fx.sound('save');
    this.fx.save();
    return true;
  }
  dialogue(id: DialogueId): void {
    this.narrative.start(id);
    this.fx.dialogue();
  }
  get zoneName(): string {
    return chunks.find((c) => c.id === this.zone)?.name ?? 'CHAMBRE D’ÉVEIL';
  }
  /** A guardian or enemy is down: bosses persist in the save, others until the next death. */
  defeated(guardian: string): boolean {
    return this.isDefeated(guardian);
  }
  private isDefeated = (guardian: string): boolean => {
    const encounter = this.enemies.encounter(guardian);
    if (encounter) return encounter.defeated;
    return this.fallen.has(guardian) || this.enemies.defeated.has(guardian);
  };
  /**
   * Gates currently barring the way: arenas of living guardians, exits of uncleared
   * stages and the unsolved seal. Progress gates only bar the way forward (D026).
   */
  closedGates(x = this.actor.x): Set<string> {
    const closed = new Set(this.arenas.closedGates(this.isDefeated));
    for (const stage of this.stages.sealed(this.narrative.flags)) closed.add(stageGate(stage.id));
    if (!this.echoOpen && !this.narrative.flags.has('echo-gate-open')) closed.add('echo');
    this.stages.locate(x, gates);
    for (const id of closed) if (progressGates.has(id) && this.stages.beyond(id)) closed.delete(id);
    return closed;
  }
  /** Gates after a teleport, a respawn or a load: sides are measured afresh at `x`. */
  relocate(x: number): Set<string> {
    this.stages.reset();
    return this.closedGates(x);
  }
  /** Health bar of the guardian currently fought, if any. */
  get bossBar(): { name: string; subtitle: string; health: number; maxHealth: number } | null {
    const boss = this.activeBoss;
    if (boss)
      return {
        name: boss.data.name,
        subtitle: boss.data.subtitle,
        health: boss.actor.health,
        maxHealth: boss.actor.maxHealth,
      };
    // An elite guarding a sealed arena.
    const arena = this.arenas.active;
    const elite = arena ? this.enemies.entities.get(arena.guardian) : undefined;
    if (arena && elite && elite.actor.health > 0)
      return {
        name: arena.name,
        subtitle: arena.subtitle,
        health: elite.actor.health,
        maxHealth: elite.actor.maxHealth,
      };
    return null;
  }
  /** The boss currently fighting, if any. */
  get activeBoss(): BossEncounter | null {
    return this.enemies.bosses.find((b) => b.active) ?? null;
  }
  get bossActive(): boolean {
    return this.activeBoss !== null;
  }
  dispose(): void {
    this.player.dispose();
    this.events.clear();
  }
}

import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Control } from '@babylonjs/gui/2D/controls/control';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { GameSession } from '../core/GameSession';
import { guardianData } from '../../game-data/bosses/guardian';
import { focusData } from '../../game-data/abilities/abilities';
interface FloatingNumber {
  text: TextBlock;
  x: number;
  y: number;
  life: number;
  duration: number;
  scale: number;
}
interface EnemyBar {
  frame: Rectangle;
  fill: Rectangle;
}
const HEALTH_WIDTH = 260;
/** Babylon GUI heads-up display. It reads the session and never changes it. */
export class Hud {
  private texture: AdvancedDynamicTexture;
  private health: Rectangle;
  private chip: Rectangle;
  private energy: Rectangle;
  private label: TextBlock;
  private vitals: TextBlock;
  private shards: TextBlock;
  private ticks: Rectangle[] = [];
  private resonance: { frame: Rectangle; fill: Rectangle }[] = [];
  private boss: Rectangle;
  private bossFill: Rectangle;
  private bossChip: Rectangle;
  private bossLabel: TextBlock;
  private bossSubtitle: TextBlock;
  private numbers: FloatingNumber[] = [];
  private numberCursor = 0;
  private bars: EnemyBar[] = [];
  private barTimers = new Map<string, number>();
  private chipValue = 1;
  private bossChipValue = 1;
  private shardCount = -1;
  private shardPop = 0;
  private point = new Vector3();
  constructor(private scene: Scene) {
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI('eidra-hud', true, scene);
    this.texture.idealWidth = 1440;
    if (this.texture.layer) this.texture.layer.applyPostProcess = false;
    const container = new Rectangle('status');
    container.width = '340px';
    container.height = '110px';
    container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    container.left = '40px';
    container.top = '26px';
    container.thickness = 0;
    this.texture.addControl(container);
    const text = (name: string, value: string, size: number, color: string): TextBlock => {
      const block = new TextBlock(name, value);
      block.fontSize = size;
      block.color = color;
      block.fontFamily = 'Georgia, serif';
      block.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      block.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      block.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      block.height = `${size + 8}px`;
      block.shadowColor = '#000a';
      block.shadowBlur = 6;
      return block;
    };
    this.label = text('name', 'E I D R A  ·  0 7', 13, '#e4e2cc');
    container.addControl(this.label);
    this.vitals = text('vitals', '100 / 100', 11, '#a9bdb3');
    this.vitals.left = '205px';
    this.vitals.top = '2px';
    this.vitals.width = '70px';
    this.vitals.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    container.addControl(this.vitals);
    const bar = (
      name: string,
      width: number,
      height: number,
      top: number,
      color: string,
      parent: Rectangle,
    ): Rectangle => {
      const background = new Rectangle(name + '-background');
      background.width = width + 'px';
      background.height = height + 'px';
      background.top = top + 'px';
      background.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      background.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      background.thickness = 1;
      background.color = '#6a787066';
      background.background = '#0a1a1acc';
      parent.addControl(background);
      const fill = new Rectangle(name);
      fill.width = 1;
      fill.height = 1;
      fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fill.thickness = 0;
      fill.background = color;
      background.addControl(fill);
      return fill;
    };
    // Health: a delayed amber chip shows the size of the last blow.
    this.chip = bar('health-chip', HEALTH_WIDTH, 10, 26, '#e3a25f', container);
    this.health = new Rectangle('health');
    this.health.width = 1;
    this.health.height = 1;
    this.health.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.health.thickness = 0;
    this.health.background = '#dfe8cf';
    this.chip.parent!.addControl(this.health);
    for (let i = 0; i < 8; i++) {
      const tick = new Rectangle('health-tick');
      tick.width = '1px';
      tick.height = 1;
      tick.thickness = 0;
      tick.background = '#0a1a1a';
      tick.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      this.chip.parent!.addControl(tick);
      this.ticks.push(tick);
    }
    this.energy = bar('memory', 190, 3, 42, '#73d5c1', container);
    // Resonance: three diamonds filled by landing blows, spent by Recueillement.
    for (let i = 0; i < 3; i++) {
      const frame = new Rectangle('resonance-frame');
      frame.width = '13px';
      frame.height = '13px';
      frame.rotation = Math.PI / 4;
      frame.thickness = 1;
      frame.color = '#9bcebd';
      frame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      frame.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      frame.left = `${4 + i * 24}px`;
      frame.top = '58px';
      const fill = new Rectangle('resonance-fill');
      fill.width = '9px';
      fill.height = '9px';
      fill.thickness = 0;
      fill.background = '#bff5e3';
      frame.addControl(fill);
      container.addControl(frame);
      this.resonance.push({ frame, fill });
    }
    this.shards = text('shards', '◆ 0', 14, '#e2c48d');
    this.shards.left = '84px';
    this.shards.top = '54px';
    this.shards.width = '120px';
    this.shards.transformCenterX = 0;
    container.addControl(this.shards);
    // Boss: name card, subtitle, chip track and the phase threshold marker.
    this.boss = new Rectangle('boss-panel');
    this.boss.width = '700px';
    this.boss.height = '80px';
    this.boss.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.boss.top = '-64px';
    this.boss.thickness = 0;
    this.texture.addControl(this.boss);
    this.bossLabel = new TextBlock('boss-name', guardianData.name);
    this.bossLabel.fontSize = 17;
    this.bossLabel.fontFamily = 'Georgia, serif';
    this.bossLabel.color = '#ecd8b2';
    this.bossLabel.top = '-22px';
    this.bossLabel.shadowColor = '#000c';
    this.bossLabel.shadowBlur = 8;
    this.boss.addControl(this.bossLabel);
    this.bossSubtitle = new TextBlock('boss-subtitle', guardianData.subtitle);
    this.bossSubtitle.fontSize = 10;
    this.bossSubtitle.color = '#9fb1a8';
    this.bossSubtitle.top = '-3px';
    this.boss.addControl(this.bossSubtitle);
    const track = new Rectangle('boss-track');
    track.width = 1;
    track.height = '7px';
    track.top = '17px';
    track.background = '#1d2f30dd';
    track.color = '#c2a26c55';
    track.thickness = 1;
    this.boss.addControl(track);
    const fillBar = (name: string, color: string): Rectangle => {
      const fill = new Rectangle(name);
      fill.width = 1;
      fill.height = 1;
      fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fill.thickness = 0;
      fill.background = color;
      track.addControl(fill);
      return fill;
    };
    this.bossChip = fillBar('boss-chip', '#f0e2c0');
    this.bossFill = fillBar('boss-life', '#d5af73');
    const marker = new Rectangle('boss-phase-marker');
    marker.width = '2px';
    marker.height = '13px';
    marker.thickness = 0;
    marker.background = '#ecd8b2';
    marker.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    marker.left = `${guardianData.phaseThreshold * 700 - 1}px`;
    marker.top = '17px';
    this.boss.addControl(marker);
    // Pooled world-space widgets: floating numbers and enemy health bars.
    for (let i = 0; i < 24; i++) {
      const block = new TextBlock('damage-number', '');
      block.fontFamily = 'Georgia, serif';
      block.fontSize = 22;
      block.width = '120px';
      block.height = '40px';
      block.outlineWidth = 4;
      block.outlineColor = '#071416';
      block.isVisible = false;
      block.isHitTestVisible = false;
      this.texture.addControl(block);
      this.numbers.push({ text: block, x: 0, y: 0, life: 0, duration: 1, scale: 1 });
    }
    for (let i = 0; i < 8; i++) {
      const frame = new Rectangle('enemy-bar');
      frame.width = '64px';
      frame.height = '5px';
      frame.thickness = 1;
      frame.color = '#00000099';
      frame.background = '#0a1a1acc';
      frame.isVisible = false;
      const fill = new Rectangle('enemy-bar-fill');
      fill.width = 1;
      fill.height = 1;
      fill.thickness = 0;
      fill.background = '#e0876a';
      fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      frame.addControl(fill);
      this.texture.addControl(frame);
      this.bars.push({ frame, fill });
    }
  }
  /** Floating combat text above a world position. */
  number(x: number, y: number, value: string, color: string, big = false): void {
    const n = this.numbers[this.numberCursor++ % this.numbers.length]!;
    n.text.text = value;
    n.text.color = color;
    n.text.fontSize = big ? 30 : 21;
    n.text.isVisible = true;
    n.x = x + ((this.numberCursor % 5) - 2) * 0.18;
    n.y = y;
    n.life = n.duration = big ? 1 : 0.8;
    n.scale = big ? 1.6 : 1.3;
  }
  /** Shows a foe's health bar for a few seconds after it is struck. */
  enemyDamaged(id: string): void {
    this.barTimers.set(id, 3);
  }
  update(session: GameSession, visible: boolean, dt = 1 / 60): void {
    this.texture.rootContainer.isVisible = visible;
    if (!visible) return;
    const actor = session.actor;
    const ratio = Math.max(0.001, actor.health / actor.maxHealth);
    this.health.width = ratio;
    this.chipValue = ratio >= this.chipValue ? ratio : Math.max(ratio, this.chipValue - dt * 0.45);
    this.chip.width = Math.max(0.001, this.chipValue);
    this.health.background = ratio < 0.3 ? '#f0b39a' : '#dfe8cf';
    const segments = Math.round(actor.maxHealth / 20);
    this.ticks.forEach((tick, i) => {
      tick.isVisible = i < segments - 1;
      tick.left = `${((i + 1) / segments) * HEALTH_WIDTH}px`;
    });
    this.energy.width = Math.max(0.001, session.abilities.energy / 100);
    this.vitals.text = `${Math.ceil(actor.health)} / ${actor.maxHealth}`;
    const resonance = session.focus.resonance;
    this.resonance.forEach(({ frame, fill }, i) => {
      const amount = Math.max(0, Math.min(1, (resonance - i * focusData.cost) / focusData.cost));
      fill.alpha = amount >= 1 ? 1 : amount * 0.45;
      fill.scaleX = fill.scaleY = amount >= 1 ? 1 : 0.4 + amount * 0.4;
      frame.color = amount >= 1 ? '#d8fff1' : '#6f9c8f';
      frame.scaleX = frame.scaleY = amount >= 1 && session.focus.channeling ? 1.25 : 1;
    });
    const shards = session.inventory.shards;
    if (shards !== this.shardCount) {
      if (shards > this.shardCount && this.shardCount >= 0) this.shardPop = 1;
      this.shardCount = shards;
      this.shards.text = `◆ ${shards}`;
    }
    this.shardPop = Math.max(0, this.shardPop - dt * 4);
    this.shards.scaleX = this.shards.scaleY = 1 + this.shardPop * 0.35;
    this.shards.color = this.shardPop > 0 ? '#fff0c8' : '#e2c48d';
    const boss = session.enemies.boss,
      director = session.enemies.director;
    this.boss.isVisible = session.bossActive;
    const bossRatio = Math.max(0.001, boss.health / boss.maxHealth);
    this.bossFill.width = bossRatio;
    this.bossChipValue =
      bossRatio >= this.bossChipValue
        ? bossRatio
        : Math.max(bossRatio, this.bossChipValue - dt * 0.3);
    this.bossChip.width = Math.max(0.001, this.bossChipValue);
    const cue: Record<string, string> = {
      sweep: 'BALAYAGE — PARADE OU ESQUIVE',
      slam: 'ONDE — SAUTEZ',
      charge: 'CHARGE — ESQUIVEZ',
      rain: 'PLUIE D’ÉCLATS — QUITTEZ LES MARQUES',
    };
    this.bossSubtitle.text =
      director.state === 'windup'
        ? (cue[director.pattern.id] ?? guardianData.subtitle)
        : director.state === 'transition'
          ? 'IL SE SOUVIENT DE SA COLÈRE'
          : guardianData.subtitle;
    this.bossSubtitle.color = director.state === 'windup' ? '#ffb27a' : '#9fb1a8';
    this.bossFill.background = director.phase === 2 ? '#e0895a' : '#d5af73';
    for (const n of this.numbers) {
      if (n.life <= 0) continue;
      n.life -= dt;
      const t = 1 - Math.max(0, n.life) / n.duration;
      this.point.set(n.x, n.y + t * 1.1, 0);
      n.text.moveToVector3(this.point, this.scene);
      n.text.alpha = Math.min(1, (1 - t) * 2.5);
      const pop = 1 + (n.scale - 1) * Math.max(0, 1 - t * 6);
      n.text.scaleX = n.text.scaleY = pop;
      n.text.isVisible = n.life > 0;
    }
    let used = 0;
    for (const [id, timer] of this.barTimers) {
      const entity = session.enemies.entities.get(id);
      const left = timer - dt;
      if (!entity || left <= 0 || entity.actor.health <= 0) {
        this.barTimers.delete(id);
        continue;
      }
      this.barTimers.set(id, left);
      const bar = this.bars[used++];
      if (!bar) continue;
      const a = entity.actor;
      this.point.set(a.x, a.y + a.height * 0.75 + 0.25, 0);
      bar.frame.isVisible = true;
      bar.frame.alpha = Math.min(1, left * 2);
      bar.frame.moveToVector3(this.point, this.scene);
      bar.fill.width = Math.max(0.001, a.health / a.maxHealth);
    }
    for (let i = used; i < this.bars.length; i++) this.bars[i]!.frame.isVisible = false;
  }
  dispose(): void {
    this.texture.dispose();
  }
}

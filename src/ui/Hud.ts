import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle';
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock';
import { Control } from '@babylonjs/gui/2D/controls/control';
import type { Scene } from '@babylonjs/core/scene';
import type { GameSession } from '../core/GameSession';
export class Hud {
  private texture: AdvancedDynamicTexture;
  private health: Rectangle;
  private energy: Rectangle;
  private label: TextBlock;
  private boss: Rectangle;
  private bossFill: Rectangle;
  private bossLabel: TextBlock;
  constructor(scene: Scene) {
    this.texture = AdvancedDynamicTexture.CreateFullscreenUI('eidra-hud', true, scene);
    this.texture.idealWidth = 1440;
    const container = new Rectangle('status');
    container.width = '300px';
    container.height = '96px';
    container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    container.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    container.left = '40px';
    container.top = '28px';
    container.thickness = 0;
    this.texture.addControl(container);
    this.label = new TextBlock('name', 'E I D R A  /  0 7');
    this.label.color = '#e4e2cc';
    this.label.fontSize = 13;
    this.label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.label.height = '24px';
    this.label.top = '-32px';
    container.addControl(this.label);
    const makeBar = (
      name: string,
      width: number,
      height: number,
      top: number,
      color: string,
    ): Rectangle => {
      const background = new Rectangle(name + '-background');
      background.width = width + 'px';
      background.height = height + 'px';
      background.top = top + 'px';
      background.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      background.thickness = 1;
      background.color = '#6a7870';
      background.background = '#102424';
      container.addControl(background);
      const fill = new Rectangle(name);
      fill.width = 1;
      fill.height = 1;
      fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fill.thickness = 0;
      fill.background = color;
      background.addControl(fill);
      return fill;
    };
    this.health = makeBar('health', 255, 7, 0, '#cfdebd');
    this.energy = makeBar('memory', 180, 3, 17, '#73d5c1');
    this.boss = new Rectangle('boss-panel');
    this.boss.width = '660px';
    this.boss.height = '65px';
    this.boss.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.boss.top = '-76px';
    this.boss.thickness = 0;
    this.texture.addControl(this.boss);
    this.bossLabel = new TextBlock('boss-name', 'G A R D I E N   S A N S   V I S A G E');
    this.bossLabel.fontSize = 14;
    this.bossLabel.color = '#e8d4af';
    this.bossLabel.top = '-15px';
    this.boss.addControl(this.bossLabel);
    const back = new Rectangle('boss-track');
    back.width = 1;
    back.height = '5px';
    back.top = '14px';
    back.background = '#263b3b';
    back.thickness = 0;
    this.boss.addControl(back);
    this.bossFill = new Rectangle('boss-life');
    this.bossFill.width = 1;
    this.bossFill.height = 1;
    this.bossFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.bossFill.thickness = 0;
    this.bossFill.background = '#d5af73';
    back.addControl(this.bossFill);
  }
  update(session: GameSession, visible: boolean): void {
    this.texture.rootContainer.isVisible = visible;
    this.health.width = Math.max(0.001, session.actor.health / session.actor.maxHealth);
    this.energy.width = Math.max(0.001, session.abilities.energy / 100);
    this.label.text = `E I D R A  /  0 7               ${Math.ceil(session.actor.health)} / ${session.actor.maxHealth}`;
    this.boss.isVisible = session.bossActive;
    this.bossFill.width = Math.max(
      0.001,
      session.enemies.boss.health / session.enemies.boss.maxHealth,
    );
    this.bossLabel.text =
      session.enemies.director.state === 'windup'
        ? `GARDIEN SANS VISAGE  ·  ${{ sweep: 'BALAYAGE', slam: 'ONDE — SAUTEZ', charge: 'CHARGE', rain: 'PLUIE D’ÉCLATS' }[session.enemies.director.pattern.id]}`
        : 'G A R D I E N   S A N S   V I S A G E';
  }
  dispose(): void {
    this.texture.dispose();
  }
}

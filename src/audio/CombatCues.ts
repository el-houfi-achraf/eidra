import { patternCues } from '../../game-data/audio/sounds';
import type { CueId } from '../../game-data/audio/sounds';
import type { Hazard } from '../../game-data/zones/laboratory';
import type { EnemyManager } from '../enemies/EnemyManager';
import { ventState } from '../combat/Hazards';
import type { VentState } from '../combat/Hazards';
export interface SoundEvent {
  id: CueId;
  x: number;
  y: number;
}
/** Vents are heard only this close, metres. */
const VENT_RANGE = 16;
/**
 * Turns what enemies, bosses and hazards are doing into sounds, by watching their
 * state change from one step to the next: an enemy noticing Eidra, winding up and
 * striking; a boss's roar, telegraphs and blows; its signature's lasting effects
 * (standard pulses, the gaze punishing, geysers, landings, shattering reflections);
 * vents bursting nearby. Pure: it reads the simulation and returns events.
 */
export class CombatCues {
  private enemies = new Map<string, string>();
  private bosses = new Map<
    string,
    { state: string; leaping: boolean; reflections: { x: number; y: number }[]; punished: number }
  >();
  private vents = new Map<string, VentState>();
  update(
    manager: EnemyManager,
    hazards: readonly Hazard[],
    time: number,
    player: { x: number; y: number },
  ): SoundEvent[] {
    const out: SoundEvent[] = [];
    const at = (id: CueId | undefined, x: number, y: number): void => {
      if (id) out.push({ id, x, y });
    };
    const alive = new Set<string>();
    for (const entity of manager.entities.values()) {
      const { actor, fsm } = entity;
      alive.add(actor.id);
      const before = this.enemies.get(actor.id);
      this.enemies.set(actor.id, fsm.state);
      if (actor.health <= 0) continue;
      if (fsm.state !== before) {
        if (fsm.state === 'DETECT') at('enemy-alert', actor.x, actor.y);
        if (fsm.state === 'ALERT') at('enemy-windup', actor.x, actor.y);
      }
      if (fsm.attackTriggered)
        at(entity.data.ranged ? 'enemy-shot' : 'enemy-swing', actor.x, actor.y);
    }
    for (const id of this.enemies.keys()) if (!alive.has(id)) this.enemies.delete(id);
    for (const encounter of manager.bosses) {
      const { actor, director, data } = encounter;
      const last = this.bosses.get(data.id);
      const now = {
        state: director.state,
        leaping: encounter.leap !== null,
        reflections: encounter.reflections.map((r) => ({ x: r.actor.x, y: r.actor.y })),
        punished: encounter.punished,
      };
      this.bosses.set(data.id, now);
      if (!last || actor.health <= 0) continue;
      const cues = patternCues[director.pattern.kind];
      if (now.state !== last.state) {
        if (now.state === 'intro' || now.state === 'transition') at('boss-roar', actor.x, actor.y);
        if (now.state === 'windup') at(cues.windup, actor.x, actor.y);
      }
      if (director.trigger) {
        const geyser = encounter.geysers.at(-1);
        if (director.pattern.kind === 'eruption' && geyser) at(cues.strike, geyser.x, 0.5);
        else at(cues.strike, actor.x, actor.y);
      }
      if (last.leaping && !now.leaping) at('boss-slam', actor.x, actor.y);
      if (encounter.pulsed && encounter.standard) at('standard-pulse', encounter.standard.x, 1);
      if (now.punished > last.punished) at('gaze-punish', player.x, player.y);
      // A reflection that vanished before its time was shattered (or dispelled).
      for (const r of last.reflections)
        if (!now.reflections.some((n) => n.x === r.x && n.y === r.y))
          at('reflection-shatter', r.x, r.y);
    }
    for (const vent of hazards) {
      const state = ventState(vent, time);
      const before = this.vents.get(vent.id);
      this.vents.set(vent.id, state);
      if (
        before &&
        before !== 'burning' &&
        state === 'burning' &&
        Math.abs(vent.x - player.x) < VENT_RANGE
      )
        at('vent', vent.x, 1);
    }
    return out;
  }
  reset(): void {
    this.enemies.clear();
    this.bosses.clear();
    this.vents.clear();
  }
}

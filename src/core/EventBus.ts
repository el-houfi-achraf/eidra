export interface GameEvents {
  PLAYER_DAMAGED: { amount: number; health: number };
  PLAYER_DIED: undefined;
  ABILITY_UNLOCKED: { id: string };
  BOSS_DEFEATED: { id: string };
  CHECKPOINT_ACTIVATED: { id: string };
  MEMORY_DISCOVERED: { id: string };
  QUEST_UPDATED: { id: string };
}
export class EventBus<Events extends object = GameEvents> {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>();
  on<K extends keyof Events>(type: K, listener: (payload: Events[K]) => void): () => void {
    const handlers = this.listeners.get(type) ?? new Set<(payload: never) => void>();
    handlers.add(listener);
    this.listeners.set(type, handlers);
    return () => {
      handlers.delete(listener);
    };
  }
  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    this.listeners.get(type)?.forEach((handler) => handler(payload as never));
  }
  clear(): void {
    this.listeners.clear();
  }
}

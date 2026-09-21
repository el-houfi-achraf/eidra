import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus';
import { GameStateMachine } from '../../src/core/GameState';
describe('Core lifecycle', () => {
  it('dispatches typed events and unsubscribes', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.on('PLAYER_DAMAGED', handler);
    bus.emit('PLAYER_DAMAGED', { amount: 2, health: 3 });
    off();
    bus.emit('PLAYER_DAMAGED', { amount: 2, health: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid state transitions', () => {
    const state = new GameStateMachine();
    expect(() => state.change('PLAYING')).toThrow();
    state.change('MAIN_MENU');
    state.change('LOADING');
    state.change('PLAYING');
    expect(state.state).toBe('PLAYING');
  });
});

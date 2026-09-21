export type GameState =
  'BOOT' | 'MAIN_MENU' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'CUTSCENE' | 'GAME_OVER' | 'ENDING';
const transitions: Record<GameState, readonly GameState[]> = {
  BOOT: ['MAIN_MENU'],
  MAIN_MENU: ['LOADING'],
  LOADING: ['PLAYING', 'MAIN_MENU'],
  PLAYING: ['PAUSED', 'CUTSCENE', 'GAME_OVER', 'ENDING', 'LOADING'],
  PAUSED: ['PLAYING', 'MAIN_MENU'],
  CUTSCENE: ['PLAYING', 'ENDING'],
  GAME_OVER: ['LOADING', 'MAIN_MENU'],
  ENDING: ['MAIN_MENU', 'PLAYING'],
};
export class GameStateMachine {
  state: GameState = 'BOOT';
  change(next: GameState): void {
    if (!transitions[this.state].includes(next))
      throw new Error(`Invalid game transition: ${this.state} → ${next}`);
    this.state = next;
  }
}

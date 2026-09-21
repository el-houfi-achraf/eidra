import { Game } from './core/Game';
import { reportError } from './core/errors';
import './ui/style.css';
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (canvas) {
  const game = new Game(canvas);
  void game.boot().catch((error) => reportError(error, true));
  if (import.meta.hot) import.meta.hot.dispose(() => void game.dispose());
} else reportError(new Error('Missing game canvas'), true);

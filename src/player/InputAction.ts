export enum InputAction {
  Left = 'left',
  Right = 'right',
  Up = 'up',
  Down = 'down',
  Walk = 'walk',
  Jump = 'jump',
  Dash = 'dash',
  Attack = 'attack',
  Charge = 'charge',
  Parry = 'parry',
  Remanence = 'remanence',
  Echo = 'echo',
  Heal = 'heal',
  Interact = 'interact',
  Map = 'map',
  Pause = 'pause',
}
export const defaultBindings: Record<InputAction, string> = {
  left: 'KeyA',
  right: 'KeyD',
  // W also jumps: with the attack, a leap that strikes overhead.
  up: 'KeyW',
  down: 'KeyS',
  walk: 'ControlLeft',
  jump: 'Space',
  dash: 'ShiftLeft',
  attack: 'KeyJ',
  charge: 'KeyK',
  parry: 'KeyL',
  remanence: 'KeyQ',
  echo: 'KeyR',
  heal: 'KeyF',
  interact: 'KeyE',
  map: 'Tab',
  pause: 'Escape',
};
export const actionLabels: Record<InputAction, string> = {
  left: 'Aller à gauche',
  right: 'Aller à droite',
  up: 'Viser vers le haut',
  down: 'Viser vers le bas',
  walk: 'Marcher',
  jump: 'Sauter',
  dash: 'Esquive',
  attack: 'Attaque légère',
  charge: 'Attaque chargée',
  parry: 'Parade',
  remanence: 'Rémanence',
  echo: 'Écho mémoriel',
  heal: 'Carte (toucher) · Recueillement (maintenir)',
  interact: 'Interagir',
  map: 'Carte',
  pause: 'Pause',
};
/** Glyphs shown in prompts once the player last used a standard gamepad. */
export const gamepadLabels: Record<InputAction, string> = {
  left: '◀',
  right: '▶',
  up: '▲',
  down: '▼',
  walk: 'Stick',
  jump: 'A',
  dash: 'B',
  attack: 'X',
  charge: 'LT',
  parry: 'LB',
  remanence: 'Y',
  echo: 'RB',
  heal: 'RT',
  interact: 'RT',
  map: 'View',
  pause: 'Start',
};
/** Readable label for a KeyboardEvent.code or a mouse button binding. */
export function keyLabel(code: string): string {
  const named: Record<string, string> = {
    Space: 'Espace',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    Escape: 'Échap',
    Mouse0: 'Clic G',
    Mouse2: 'Clic D',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
  };
  return (
    named[code] ??
    code
      .replace(/^Key/, '')
      .replace(/^Digit/, '')
      .replace(/(Left|Right)$/, '')
  );
}

export class GameError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}
export class AssetLoadError extends GameError {}
export class SaveError extends GameError {}
export class ConfigurationError extends GameError {}

export function reportError(error: unknown, fatal = false): void {
  console.error('[EIDRA]', error);
  const element = document.getElementById(fatal ? 'fatal' : 'notice');
  if (!element) return;
  element.hidden = false;
  if (!fatal) element.classList.add('show');
  element.textContent =
    error instanceof GameError
      ? error.message
      : 'Une erreur est survenue. Rechargez le jeu pour réessayer.';
}

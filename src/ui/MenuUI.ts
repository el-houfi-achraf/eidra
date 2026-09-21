import type { Settings } from '../config/settings';
import { InputAction, actionLabels, defaultBindings } from '../player/InputAction';
import type { SaveData } from '../save/SaveManager';
import type { GameSession } from '../core/GameSession';
import { chunks } from '../../game-data/zones/laboratory';
export interface MenuActions {
  start: (slot: number) => void;
  load: (save: SaveData) => void;
  resume: () => void;
  menu: () => void;
  settings: (value: Settings) => void;
  save: () => void;
  advance: () => void;
  respawn: () => void;
}
const mark =
  '<svg viewBox="0 0 48 64" aria-hidden="true"><path d="M24 3 44 32 24 61 4 32Z M24 13 35 32 24 51 13 32Z M24 3V20 M24 44V61"/></svg>';
export class MenuUI {
  private root: HTMLElement;
  private messageTimer = 0;
  private captionTimer = 0;
  private returnTo: () => void = () => undefined;
  private keyCapture: ((e: KeyboardEvent) => void) | null = null;
  constructor(private actions: MenuActions) {
    this.root = document.getElementById('interface')!;
  }
  private bind(id: string, handler: () => void): void {
    this.root.querySelector(`#${id}`)?.addEventListener('click', handler);
  }
  caption(text: string): void {
    let el = document.getElementById('audio-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'audio-caption';
      el.setAttribute('role', 'status');
      document.body.append(el);
    }
    el.textContent = text;
    window.clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => {
      el!.textContent = '';
    }, 2200);
  }
  private focus(): void {
    this.root.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }
  main(saves: (SaveData | null)[], settings: Settings): void {
    const recent = saves
      .filter((s): s is SaveData => s !== null)
      .sort((a, b) => b.savedAt - a.savedAt)[0];
    this.root.innerHTML = `<div class="menu-scrim"></div><header class="masthead"><span class="wordmark">${mark} NHALIS</span><span class="edition">LES ARCHIVES DU SILENCE <i></i></span></header><section class="main-menu"><p class="eyebrow"><span></span> UN MONDE QUI REFUSE D’OUBLIER</p><h1>EIDRA</h1><p class="subtitle">SHARDS OF SILENCE</p><div class="title-rule"></div><p class="tagline">Certains souvenirs attendent<br>qu’on les laisse partir.</p><nav aria-label="Menu principal"><button id="continue" class="menu-link primary" ${recent ? '' : 'disabled'}><span>Continuer</span><b aria-hidden="true">↗</b></button><button id="new" class="menu-link"><span>Nouvelle partie</span><b aria-hidden="true">→</b></button><button id="load" class="menu-link"><span>Charger une partie</span><b aria-hidden="true">+</b></button><button id="settings" class="menu-link"><span>Réglages</span><b aria-hidden="true">+</b></button></nav></section><aside class="chapter-card"><span class="tiny">CHAPITRE 00</span><h2>Le laboratoire<br>de l’éveil</h2><p>Quelque chose se souvient de vous.</p><span class="chapter-line"></span></aside><footer class="menu-footer"><span>07 <i>/</i> SEPT FRAGMENTS. UNE CONSCIENCE.</span><span>CLAVIER + SOURIS <i>·</i> MANETTE</span><span class="version">EIDRA · PRÉLUDE</span></footer>`;
    this.bind('continue', () => {
      if (recent) this.actions.load(recent);
    });
    this.bind('new', () => this.slots(saves, true, () => this.main(saves, settings)));
    this.bind('load', () => this.slots(saves, false, () => this.main(saves, settings)));
    this.bind('settings', () => this.settings(settings, () => this.main(saves, settings)));
    this.focus();
  }
  private slots(saves: (SaveData | null)[], create: boolean, back: () => void): void {
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel compact"><p class="eyebrow">LES ANCRAGES</p><h2>${create ? 'Une nouvelle mémoire' : 'Retrouver une mémoire'}</h2><p class="muted">Trois emplacements, conservés dans ce navigateur.</p><div class="slots">${saves.map((save, i) => `<button class="slot" id="slot-${i}" ${!create && !save ? 'disabled' : ''}><span>0${i + 1}</span><strong>${save ? 'Laboratoire de l’éveil' : 'Emplacement libre'}</strong><small>${save ? `${Math.floor(save.playtime / 60)} min · ${save.memories.length} souvenirs` : 'Commencer le voyage'} →</small></button>`).join('')}</div><button id="back" class="text-button">← Retour</button></section>`;
    saves.forEach((save, i) =>
      this.bind(`slot-${i}`, () => {
        if (create && save) this.confirmOverwrite(i + 1, () => this.slots(saves, create, back));
        else if (create) this.actions.start(i + 1);
        else if (save) this.actions.load(save);
      }),
    );
    this.bind('back', back);
    this.focus();
  }
  private confirmOverwrite(slot: number, back: () => void): void {
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel compact"><p class="eyebrow">EMPLACEMENT 0${slot}</p><h2>Remplacer cette mémoire ?</h2><p>La progression précédente de cet emplacement sera remplacée.</p><button class="solid-button" id="replace">Remplacer et commencer</button><button class="text-button" id="back">Conserver ma partie</button></section>`;
    this.bind('replace', () => this.actions.start(slot));
    this.bind('back', back);
    this.focus();
  }
  playing(): void {
    this.root.innerHTML =
      '<div class="ingame"><div class="zone-label"><span class="tiny">LABORATOIRE DE L’ÉVEIL</span><p id="zone-name"></p></div><div id="objective" class="objective"></div><div id="interaction" class="interaction"></div><div id="abilities" class="ability-dock"></div><div class="journal-hint">TAB <span>Carte & souvenirs</span> &nbsp; ESC <span>Pause</span></div></div>';
  }
  update(session: GameSession, labels: Record<InputAction, string>): void {
    const zone = this.root.querySelector('#zone-name');
    if (zone) zone.textContent = session.zoneName;
    const obj = this.root.querySelector('#objective');
    if (obj) obj.textContent = session.quests.objective(session.narrative.flags);
    const interaction = this.root.querySelector('#interaction');
    if (interaction) {
      interaction.textContent = session.interaction;
      interaction.classList.toggle('visible', Boolean(session.interaction));
    }
    const abilities = this.root.querySelector('#abilities');
    if (abilities) {
      const entries: [
        [InputAction, string, string],
        [InputAction, string, string],
        [InputAction, string, string],
      ] = [
        [InputAction.Dash, 'dash', 'Élan'],
        [InputAction.Remanence, 'remanence', 'Rémanence'],
        [InputAction.Echo, 'memory-step', 'Memory Step'],
      ];
      const signature = entries
        .map(
          ([a, id]) =>
            `${labels[a]}${session.abilities.unlocked.has(id as 'dash')}${id === 'remanence' && session.abilities.remanence}`,
        )
        .join();
      if (abilities.getAttribute('data-signature') !== signature) {
        abilities.setAttribute('data-signature', signature);
        abilities.innerHTML = entries
          .map(
            ([action, id, label]) =>
              `<div class="ability ${session.abilities.unlocked.has(id as 'dash') ? '' : 'locked'} ${id === 'remanence' && session.abilities.remanence ? 'active' : ''}"><kbd>${labels[action].replace('Key', '').replace('Left', '')}</kbd><span>${label}</span></div>`,
          )
          .join('');
      }
    }
  }
  pause(settings: Settings): void {
    this.root.innerHTML =
      '<div class="modal-scrim"></div><section class="panel compact"><p class="eyebrow">LE TEMPS SUSPENDU</p><h2>Une respiration.</h2><button id="resume" class="solid-button">Reprendre le voyage →</button><button id="save" class="panel-link">Sauvegarder</button><button id="settings" class="panel-link">Réglages</button><button id="menu" class="panel-link">Menu principal</button><p class="muted small">Les ancrages restaurent votre santé et votre mémoire.</p></section>';
    this.bind('resume', this.actions.resume);
    this.bind('save', this.actions.save);
    this.bind('settings', () => this.settings(settings, () => this.pause(settings)));
    this.bind('menu', this.actions.menu);
    this.focus();
  }
  settings(settings: Settings, back: () => void): void {
    this.returnTo = back;
    const slider = (id: keyof Settings, label: string, min: number, max: number, step: number) =>
      `<label class="setting"><span>${label}</span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[id]}" aria-label="${label}"></label>`;
    const toggle = (id: keyof Settings, label: string) =>
      `<label class="setting"><span>${label}</span><input id="${id}" type="checkbox" ${settings[id] ? 'checked' : ''}></label>`;
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel settings-panel"><div class="panel-heading"><div><p class="eyebrow">À VOTRE RYTHME</p><h2>Réglages</h2></div><button id="back" class="text-button">Terminé ↗</button></div><div class="settings-grid"><div><h3>Affichage</h3><label class="setting"><span>Qualité</span><select id="preset">${['LOW', 'MEDIUM', 'HIGH', 'ULTRA'].map((p) => `<option ${p === settings.preset ? 'selected' : ''}>${p}</option>`).join('')}</select></label>${slider('brightness', 'Luminosité', 0.7, 1.5, 0.05)}${slider('contrast', 'Contraste', 0.8, 1.5, 0.05)}${slider('shake', 'Secousses', 0, 1, 0.1)}${slider('cameraSensitivity', 'Réactivité caméra', 0.5, 2, 0.1)}${toggle('reducedMotion', 'Mouvements réduits')}${toggle('chromaticAberration', 'Aberration chromatique')}<h3>Audio</h3>${slider('master', 'Volume général', 0, 1, 0.05)}${slider('music', 'Musique & ambiance', 0, 1, 0.05)}${slider('effects', 'Effets sonores', 0, 1, 0.05)}</div><div><h3>Accessibilité</h3>${toggle('subtitles', 'Sous-titres d’ambiance')}${toggle('memoryToggle', 'Rémanence : appui pour basculer')}${toggle('assist', 'Assistance : dégâts reçus réduits')}<h3>Commandes</h3><p class="muted small">Cliquez sur une touche pour la remplacer. Les flèches et la souris restent disponibles.</p><div class="bindings">${Object.values(
      InputAction,
    )
      .map(
        (action) =>
          `<button class="binding" data-action="${action}"><span>${actionLabels[action]}</span><kbd>${(settings.bindings[action] ?? defaultBindings[action]).replace('Key', '').replace('Left', '')}</kbd></button>`,
      )
      .join(
        '',
      )}</div><p class="muted small">Manette : A saut · X attaque · B esquive · Y Rémanence · LB parade · RB Écho · RT interaction · LT charge · Start pause.</p></div></div></section>`;
    for (const key of [
      'master',
      'music',
      'effects',
      'brightness',
      'contrast',
      'shake',
      'cameraSensitivity',
    ] as const)
      this.root.querySelector<HTMLInputElement>('#' + key)?.addEventListener('input', (event) => {
        settings[key] = Number((event.target as HTMLInputElement).value);
        this.actions.settings(settings);
      });
    for (const key of [
      'reducedMotion',
      'chromaticAberration',
      'subtitles',
      'memoryToggle',
      'assist',
    ] as const)
      this.root.querySelector<HTMLInputElement>('#' + key)?.addEventListener('change', (event) => {
        settings[key] = (event.target as HTMLInputElement).checked;
        this.actions.settings(settings);
      });
    this.root.querySelector<HTMLSelectElement>('#preset')?.addEventListener('change', (event) => {
      settings.preset = (event.target as HTMLSelectElement).value as Settings['preset'];
      this.actions.settings(settings);
    });
    this.root.querySelectorAll<HTMLButtonElement>('.binding').forEach((button) =>
      button.addEventListener('click', () => {
        this.cancelCapture();
        const action = button.dataset.action as InputAction;
        button.querySelector('kbd')!.textContent = '…';
        this.keyCapture = (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.code !== 'Escape') {
            const effective = { ...defaultBindings, ...settings.bindings };
            const other = Object.values(InputAction).find(
              (a) => a !== action && effective[a] === event.code,
            );
            if (other) settings.bindings[other] = effective[action];
            settings.bindings[action] = event.code;
            this.actions.settings(settings);
          }
          this.cancelCapture();
          this.settings(settings, back);
        };
        window.addEventListener('keydown', this.keyCapture, true);
      }),
    );
    this.bind('back', () => {
      this.cancelCapture();
      this.returnTo();
    });
    this.focus();
  }
  navigate(direction: number, activate: boolean): void {
    if (this.keyCapture) return;
    const controls = [...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    if (direction && controls.length) {
      const index = controls.indexOf(document.activeElement as HTMLButtonElement);
      controls[(index + direction + controls.length) % controls.length]?.focus();
    }
    if (
      activate &&
      document.activeElement instanceof HTMLButtonElement &&
      this.root.contains(document.activeElement)
    )
      document.activeElement.click();
  }
  private cancelCapture(): void {
    if (this.keyCapture) {
      window.removeEventListener('keydown', this.keyCapture, true);
      this.keyCapture = null;
    }
  }
  dialogue(session: GameSession): void {
    this.root.innerHTML = `<div class="cinematic-bars"></div><section class="dialogue"><p class="eyebrow">${session.narrative.speaker}</p><p class="dialogue-line"></p><button id="advance" class="text-button">Continuer <kbd>E / A</kbd> →</button></section>`;
    this.root.querySelector('.dialogue-line')!.textContent = session.narrative.line;
    this.bind('advance', this.actions.advance);
    this.focus();
  }
  death(): void {
    this.root.innerHTML =
      '<div class="death-scrim"></div><section class="death-panel"><p class="eyebrow">CE N’EST PAS LA FIN</p><h2>La mémoire demeure.</h2><p>Votre dernier ancrage vous attend.</p><button id="respawn" class="solid-button">Se reconstituer →</button><button id="menu" class="text-button">Menu principal</button></section>';
    this.bind('respawn', this.actions.respawn);
    this.bind('menu', this.actions.menu);
    this.focus();
  }
  map(session: GameSession): void {
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel map-panel"><p class="eyebrow">CARTOGRAPHIE DE LA RÉMANENCE</p><h2>Le laboratoire de l’éveil</h2><div class="zone-map">${chunks.map((c) => `<div class="map-node ${session.discovered.has(c.id) ? 'discovered' : ''} ${session.actor.x >= c.start && session.actor.x < c.end ? 'current' : ''}"><span>${session.discovered.has(c.id) ? c.name : 'INCONNU'}</span><i>◇</i></div>`).join('')}</div><div class="map-key"><span>◇ Ancrage</span><span class="mint">◆ Votre position</span><span>··· Passage oublié</span></div><h3>Fragments retrouvés</h3><div class="memory-list">${['kael', 'seris', 'ilyan', 'vaela', 'deren', 'noa', 'aren'].map((id, i) => `<span class="${session.narrative.memories.has(id) ? 'found' : ''}"><b>0${i + 1}</b> ${session.narrative.memories.has(id) ? id.toUpperCase() : 'INCONNU'}</span>`).join('')}</div><p class="muted">${session.quests.objective(session.narrative.flags)} · ${session.inventory.shards} éclats</p><button id="back" class="text-button">Reprendre le voyage →</button></section>`;
    this.bind('back', this.actions.resume);
    this.focus();
  }
  ending(session: GameSession): void {
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel compact"><p class="eyebrow">FIN DU PRÉLUDE</p><h2>Un ordre peut<br>être oublié.</h2><p>La porte de Nhalis est ouverte.<br>Les Failles de cendre attendent encore.</p><div class="end-stats"><span>${session.narrative.memories.size}/2<br><small>SOUVENIRS</small></span><span>${Math.floor(session.playtime / 60)} min<br><small>DE VOYAGE</small></span></div><p class="muted small">Vous avez atteint la fin de ce prototype jouable. La suite de Nhalis est en développement.</p><button id="explore" class="solid-button">Revenir explorer →</button><button id="menu" class="text-button">Menu principal</button></section>`;
    this.bind('explore', this.actions.resume);
    this.bind('menu', this.actions.menu);
    this.focus();
  }
  loading(): void {
    this.root.innerHTML =
      '<div class="modal-scrim"></div><section class="loading-screen"><div class="loading-sigil">' +
      mark +
      '</div><p class="eyebrow">NHALIS SE SOUVIENT</p></section>';
  }
  notice(text: string): void {
    const el = document.getElementById('notice')!;
    el.textContent = text;
    el.classList.add('show');
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => el.classList.remove('show'), 5500);
  }
  dispose(): void {
    this.cancelCapture();
    window.clearTimeout(this.messageTimer);
    window.clearTimeout(this.captionTimer);
    document.getElementById('audio-caption')?.remove();
    this.root.replaceChildren();
  }
}

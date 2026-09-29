import type { Settings } from '../config/settings';
import { InputAction, actionLabels, defaultBindings, keyLabel } from '../player/InputAction';
import type { SaveData } from '../save/SaveManager';
import type { GameSession, TitleKind } from '../core/GameSession';
import { chunks, checkpoints, landmarks, stages } from '../../game-data/zones/laboratory';
import { stageFlag } from '../quests/StageProgress';
import { defaultSettings } from '../config/settings';
import { offeringData } from '../../game-data/items/offerings';
import { focusData } from '../../game-data/abilities/abilities';
export interface MenuActions {
  start: (slot: number) => void;
  load: (save: SaveData) => void;
  resume: () => void;
  menu: () => void;
  settings: (value: Settings) => void;
  save: () => void;
  advance: () => void;
  respawn: () => void;
  offer: () => void;
}
const mark =
  '<svg viewBox="0 0 48 64" aria-hidden="true"><path d="M24 3 44 32 24 61 4 32Z M24 13 35 32 24 51 13 32Z M24 3V20 M24 44V61"/></svg>';
const escape = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
export type Label = (action: InputAction) => string;
const tips = [
  'Une parade réussie double la prochaine attaque pendant une seconde.',
  'Chaque coup porté nourrit la résonance : maintenez le Recueillement pour refermer vos fêlures.',
  'En l’air, bas + attaque rebondit sur un ennemi et recharge l’élan.',
  'Les ancrages restaurent tout. Revenez-y pour offrir vos éclats contre de la vitalité.',
  'Une lueur ambrée annonce chaque attaque ennemie : observez avant de frapper.',
  'La Rémanence révèle ce qui a disparu, mais elle consume votre mémoire.',
];
const tip = (): string => tips[Math.floor(Math.random() * tips.length)]!;
const duration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
};
const ago = (time: number): string => {
  const minutes = Math.round((time - Date.now()) / 60000);
  const format = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
  if (Math.abs(minutes) < 60 * 24) return format.format(Math.round(minutes / 60), 'hour');
  return format.format(Math.round(minutes / 1440), 'day');
};
const anchorName = (id: string): string =>
  checkpoints.find((c) => c.id === id)?.name ?? 'Ancrage inconnu';
/** Keyboard or gamepad glyphs for a contextual prompt. */
const hintKeys = (action: string, label: Label): string[] =>
  ({
    move: [label(InputAction.Left), label(InputAction.Right)],
    jump: [label(InputAction.Jump)],
    attack: [label(InputAction.Attack)],
    dash: [label(InputAction.Dash)],
    parry: [label(InputAction.Parry)],
    heal: [label(InputAction.Heal)],
    remanence: [label(InputAction.Remanence)],
    echo: [label(InputAction.Echo)],
    down: [label(InputAction.Down), label(InputAction.Attack)],
  })[action] ?? [];
const controls: [InputAction, string][] = [
  [InputAction.Jump, 'Sauter'],
  [InputAction.Attack, 'Frapper'],
  [InputAction.Parry, 'Parer'],
  [InputAction.Dash, 'Élan'],
  [InputAction.Heal, 'Se recueillir'],
  [InputAction.Remanence, 'Rémanence'],
  [InputAction.Echo, 'Memory Step'],
  [InputAction.Interact, 'Interagir'],
];
export class MenuUI {
  private root: HTMLElement;
  private toastTimers = new Set<number>();
  private captionTimer = 0;
  private titleTimer = 0;
  private bannerTimer = 0;
  private typeTimer = 0;
  private typing: { element: HTMLElement; text: string; shown: number } | null = null;
  private returnTo: () => void = () => undefined;
  private keyCapture: ((e: KeyboardEvent) => void) | null = null;
  private reducedMotion = false;
  constructor(private actions: MenuActions) {
    this.root = document.getElementById('interface')!;
  }
  private bind(id: string, handler: () => void): void {
    this.root.querySelector(`#${id}`)?.addEventListener('click', handler);
  }
  /** Lazily created overlay outside the swapped menu root, so it survives state changes. */
  private overlay(id: string, className: string): HTMLElement {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = className;
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.append(el);
    }
    return el;
  }
  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }
  /** Cinematic card for a new area, a boss introduction or a victory. */
  title(kind: TitleKind, title: string, subtitle: string): void {
    const el = this.overlay('title-card', 'title-card');
    // An area name never interrupts a boss introduction or a victory card.
    if (kind === 'area' && el.classList.contains('show') && !el.classList.contains('area')) return;
    el.className = `title-card ${kind}`;
    el.innerHTML = `<span class="title-rule-left"></span><p class="title-eyebrow">${escape(subtitle)}</p><h2>${escape(title)}</h2><span class="title-ornament" aria-hidden="true">◇</span>`;
    // Restart the animation even when two cards follow each other.
    void el.offsetWidth;
    el.classList.add('show');
    window.clearTimeout(this.titleTimer);
    this.titleTimer = window.setTimeout(
      () => el.classList.remove('show'),
      kind === 'area' ? 3200 : 3800,
    );
  }
  /** Large banner when a memory power is recovered, with its control prompt. */
  abilityBanner(name: string, description: string, key: string): void {
    const el = this.overlay('ability-banner', 'ability-banner');
    el.innerHTML = `<p class="eyebrow">NOUVEAU POUVOIR</p><h2>${escape(name)}</h2><p>${escape(description)}</p><p class="banner-key"><kbd>${escape(key)}</kbd></p>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => el.classList.remove('show'), 5200);
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
    this.root.innerHTML = `<div class="menu-scrim"></div><header class="masthead"><span class="wordmark">${mark} NHALIS</span><span class="edition">LES ARCHIVES DU SILENCE <i></i></span></header><section class="main-menu"><p class="eyebrow"><span></span> UN MONDE QUI REFUSE D’OUBLIER</p><h1>EIDRA</h1><p class="subtitle">SHARDS OF SILENCE</p><div class="title-rule"></div><p class="tagline">Certains souvenirs attendent<br>qu’on les laisse partir.</p><nav aria-label="Menu principal"><button id="continue" class="menu-link primary" ${recent ? '' : 'disabled'}><span>Continuer</span><b aria-hidden="true">↗</b></button><button id="new" class="menu-link"><span>Nouvelle partie</span><b aria-hidden="true">→</b></button><button id="load" class="menu-link"><span>Charger une partie</span><b aria-hidden="true">+</b></button><button id="settings" class="menu-link"><span>Réglages</span><b aria-hidden="true">+</b></button></nav>${recent ? `<p class="last-save"><span>DERNIER ANCRAGE</span>${escape(anchorName(recent.checkpoint))} · ${duration(recent.playtime)} · ${ago(recent.savedAt)}</p>` : ''}</section><aside class="chapter-card"><span class="tiny">CHAPITRE 00</span><h2>Le laboratoire<br>de l’éveil</h2><p>Quelque chose se souvient de vous.</p><span class="chapter-line"></span></aside><footer class="menu-footer"><span>07 <i>/</i> SEPT FRAGMENTS. UNE CONSCIENCE.</span><span>CLAVIER + SOURIS <i>·</i> MANETTE</span><span class="version">EIDRA · PRÉLUDE</span></footer>`;
    this.bind('continue', () => {
      if (recent) this.actions.load(recent);
    });
    this.bind('new', () => this.slots(saves, true, () => this.main(saves, settings)));
    this.bind('load', () => this.slots(saves, false, () => this.main(saves, settings)));
    this.bind('settings', () => this.settings(settings, () => this.main(saves, settings)));
    this.focus();
  }
  private slots(saves: (SaveData | null)[], create: boolean, back: () => void): void {
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel compact"><p class="eyebrow">LES ANCRAGES</p><h2>${create ? 'Une nouvelle mémoire' : 'Retrouver une mémoire'}</h2><p class="muted">Trois emplacements, conservés dans ce navigateur.</p><div class="slots">${saves
      .map((save, i) =>
        save
          ? `<button class="slot filled" id="slot-${i}"><span class="slot-number">0${i + 1}</span><span class="slot-body"><strong>${escape(anchorName(save.checkpoint))}</strong><small>Laboratoire de l’éveil · ${ago(save.savedAt)}</small><span class="slot-stats"><i title="Temps de jeu">◷ ${duration(save.playtime)}</i><i title="Vitalité">♥ ${100 + save.healthUpgrades * 20}</i><i title="Éclats">◆ ${save.shards}</i><i title="Souvenirs">❖ ${save.memories.length}/7</i><i title="Pouvoirs">✦ ${save.abilities.length}</i></span></span><b aria-hidden="true">→</b></button>`
          : `<button class="slot" id="slot-${i}" ${create ? '' : 'disabled'}><span class="slot-number">0${i + 1}</span><span class="slot-body"><strong>Emplacement libre</strong><small>${create ? 'Commencer le voyage' : 'Aucune mémoire ici'}</small></span><b aria-hidden="true">${create ? '+' : ''}</b></button>`,
      )
      .join('')}</div><button id="back" class="text-button">← Retour</button></section>`;
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
      '<div class="ingame"><div class="zone-label"><span class="tiny">LABORATOIRE DE L’ÉVEIL</span><p id="zone-name"></p></div><div id="objective" class="objective"></div><div id="interaction" class="interaction"></div><div id="hint" class="hint" role="status" aria-live="polite"></div><div id="abilities" class="ability-dock"></div><div id="journal-hint" class="journal-hint"></div></div>';
  }
  update(session: GameSession, label: Label, showHints = true): void {
    const hintEl = this.root.querySelector<HTMLElement>('#hint');
    const hint = showHints ? session.hint : null;
    const keys = hint ? hintKeys(hint.action, label) : [];
    const hintKey = hint ? `${hint.id}|${keys.join()}` : '';
    if (hintEl && hintEl.dataset.key !== hintKey) {
      hintEl.dataset.key = hintKey;
      if (hint)
        hintEl.innerHTML = `${keys.map((k) => `<kbd>${escape(k)}</kbd>`).join(hint.action === 'down' ? '<em>+</em>' : '')}<span>${escape(hint.text)}</span>`;
      hintEl.classList.toggle('visible', Boolean(hint));
    }
    const zone = this.root.querySelector('#zone-name');
    if (zone && zone.textContent !== session.zoneName) zone.textContent = session.zoneName;
    const obj = this.root.querySelector('#objective');
    const objective = session.quests.objective(session.narrative.flags);
    if (obj && obj.textContent !== `◇ ${objective}`) obj.textContent = `◇ ${objective}`;
    const interaction = this.root.querySelector<HTMLElement>('#interaction');
    if (interaction && interaction.dataset.text !== session.interaction) {
      interaction.dataset.text = session.interaction;
      const [key, ...rest] = session.interaction.split(' · ');
      interaction.innerHTML = rest.length
        ? `<kbd>${escape(key ?? '')}</kbd><span>${escape(rest.join(' · '))}</span>`
        : `<span>${escape(session.interaction)}</span>`;
      interaction.classList.toggle('visible', Boolean(session.interaction));
    }
    const journal = this.root.querySelector<HTMLElement>('#journal-hint');
    const journalText = `${label(InputAction.Map)}|${label(InputAction.Pause)}`;
    if (journal && journal.dataset.text !== journalText) {
      journal.dataset.text = journalText;
      journal.innerHTML = `<kbd>${escape(label(InputAction.Map))}</kbd><span>Carte & souvenirs</span><kbd>${escape(label(InputAction.Pause))}</kbd><span>Pause</span>`;
    }
    const abilities = this.root.querySelector('#abilities');
    if (!abilities) return;
    const entries: [InputAction, string, string, boolean, boolean][] = [
      [InputAction.Heal, 'heal', 'Recueillement', true, session.focus.segments > 0],
      [
        InputAction.Dash,
        'dash',
        'Élan',
        session.abilities.unlocked.has('dash'),
        session.player.motion.dashCooldown === 0,
      ],
      [
        InputAction.Remanence,
        'remanence',
        'Rémanence',
        session.abilities.unlocked.has('remanence'),
        session.abilities.energy >= 10,
      ],
      [
        InputAction.Echo,
        'memory-step',
        'Memory Step',
        session.abilities.unlocked.has('memory-step'),
        session.abilities.echoCooldown === 0 && session.abilities.energy >= 25,
      ],
    ];
    const signature = entries.map(([a, , , unlocked]) => `${label(a)}${unlocked}`).join();
    if (abilities.getAttribute('data-signature') !== signature) {
      abilities.setAttribute('data-signature', signature);
      abilities.innerHTML = entries
        .map(
          ([action, id, name, unlocked]) =>
            `<div class="ability ${unlocked ? '' : 'locked'}" data-ability="${id}"><kbd>${escape(label(action))}<i class="cooldown"></i></kbd><span>${name}</span></div>`,
        )
        .join('');
    }
    // Per-frame state changes only toggle classes and a CSS variable.
    for (const [, id, , unlocked, ready] of entries) {
      const el = abilities.querySelector<HTMLElement>(`[data-ability="${id}"]`);
      if (!el) continue;
      el.classList.toggle('ready', unlocked && ready);
      el.classList.toggle(
        'active',
        (id === 'remanence' && session.abilities.remanence) ||
          (id === 'heal' && session.focus.channeling),
      );
      const cooldown =
        id === 'memory-step'
          ? session.abilities.echoCooldown / 8
          : id === 'heal'
            ? 1 - Math.min(1, session.focus.resonance / focusData.cost)
            : 0;
      const value = unlocked ? Math.max(0, Math.min(1, cooldown)).toFixed(2) : '0';
      if (el.style.getPropertyValue('--cool') !== value) el.style.setProperty('--cool', value);
    }
  }
  pause(settings: Settings, session?: GameSession, label?: Label): void {
    const objective = session ? session.quests.objective(session.narrative.flags) : '';
    const stats = session
      ? `<div class="pause-stats"><span><b>${Math.ceil(session.actor.health)}/${session.actor.maxHealth}</b><small>VITALITÉ</small></span><span><b>◆ ${session.inventory.shards}</b><small>ÉCLATS</small></span><span><b>${session.narrative.memories.size}/7</b><small>SOUVENIRS</small></span><span><b>${duration(session.playtime)}</b><small>VOYAGE</small></span></div>`
      : '';
    const reference = label
      ? `<ul class="control-list">${controls.map(([action, name]) => `<li><kbd>${escape(label(action))}</kbd><span>${name}</span></li>`).join('')}<li><kbd>${escape(label(InputAction.Down))}</kbd><em>+</em><kbd>${escape(label(InputAction.Attack))}</kbd><span>Plongée</span></li></ul>`
      : '';
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel pause-panel"><div class="pause-actions"><p class="eyebrow">LE TEMPS SUSPENDU</p><h2>Une respiration.</h2><button id="resume" class="solid-button">Reprendre le voyage →</button><button id="save" class="panel-link">Sauvegarder</button><button id="settings" class="panel-link">Réglages</button><button id="menu" class="panel-link">Menu principal</button></div><aside class="pause-side">${objective ? `<h3>Objectif</h3><p class="pause-objective">◇ ${escape(objective)}</p>` : ''}${stats}${reference ? `<h3>Commandes</h3>${reference}` : ''}<p class="muted small">${escape(tip())}</p></aside></section>`;
    this.bind('resume', this.actions.resume);
    this.bind('save', this.actions.save);
    this.bind('settings', () =>
      this.settings(settings, () => this.pause(settings, session, label)),
    );
    this.bind('menu', this.actions.menu);
    this.focus();
  }
  settings(settings: Settings, back: () => void, tab = 'display'): void {
    this.returnTo = back;
    const slider = (
      id: keyof Settings,
      label: string,
      min: number,
      max: number,
      step: number,
      unit: 'percent' | 'x',
    ) =>
      `<label class="setting"><span>${label}</span><span class="range"><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[id]}" aria-label="${label}"><output for="${id}" data-unit="${unit}"></output></span></label>`;
    const toggle = (id: keyof Settings, label: string, detail = '') =>
      `<label class="setting"><span>${label}${detail ? `<small>${detail}</small>` : ''}</span><input id="${id}" type="checkbox" role="switch" ${settings[id] ? 'checked' : ''}></label>`;
    const tabs: [string, string][] = [
      ['display', 'Affichage'],
      ['audio', 'Audio'],
      ['access', 'Accessibilité'],
      ['controls', 'Commandes'],
    ];
    const presetInfo: Record<Settings['preset'], string> = {
      LOW: 'Performances : sans étalonnage, ciel ni rayons',
      MEDIUM: 'Équilibré : étalonnage cinématique et FXAA',
      HIGH: 'Ombres et anti-crénelage MSAA',
      ULTRA: 'Résolution supérieure et ombres fines',
    };
    const panels: Record<string, string> = {
      display: `<label class="setting"><span>Qualité<small id="preset-info">${presetInfo[settings.preset]}</small></span><select id="preset">${['LOW', 'MEDIUM', 'HIGH', 'ULTRA'].map((p) => `<option ${p === settings.preset ? 'selected' : ''}>${p}</option>`).join('')}</select></label>${slider('brightness', 'Luminosité', 0.7, 1.5, 0.05, 'x')}${slider('contrast', 'Contraste', 0.8, 1.5, 0.05, 'x')}${slider('shake', 'Secousses', 0, 1, 0.1, 'percent')}${slider('cameraSensitivity', 'Réactivité caméra', 0.5, 2, 0.1, 'x')}${toggle('reducedMotion', 'Mouvements réduits', 'Coupe secousses, zooms et balancements')}${toggle('chromaticAberration', 'Aberration chromatique')}`,
      audio: `${slider('master', 'Volume général', 0, 1, 0.05, 'percent')}${slider('music', 'Musique & ambiance', 0, 1, 0.05, 'percent')}${slider('effects', 'Effets sonores', 0, 1, 0.05, 'percent')}`,
      access: `${toggle('hints', 'Aides contextuelles', 'Invites de commandes au bon moment')}${toggle('subtitles', 'Sous-titres d’ambiance')}${toggle('memoryToggle', 'Rémanence : appui pour basculer', 'Sinon, maintenir la touche')}${toggle('assist', 'Assistance', 'Dégâts reçus réduits, sans effet sur les fins')}`,
      controls: `<p class="muted small">Cliquez sur une action, puis appuyez sur la nouvelle touche. Échap annule. Les flèches et la souris restent disponibles.</p><div class="bindings">${Object.values(
        InputAction,
      )
        .map(
          (action) =>
            `<button class="binding" data-action="${action}"><span>${actionLabels[action]}</span><kbd>${escape(keyLabel(settings.bindings[action] ?? defaultBindings[action]))}</kbd></button>`,
        )
        .join(
          '',
        )}</div><p class="muted small">Manette : A saut · X attaque (bas + X en l’air : plongée) · B esquive · Y Rémanence · LB parade · RB Écho · RT interaction, maintenir pour se recueillir · LT charge · Start pause.</p>`,
    };
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel settings-panel"><div class="panel-heading"><div><p class="eyebrow">À VOTRE RYTHME</p><h2>Réglages</h2></div><button id="back" class="text-button">Terminé ↗</button></div><div class="tabs" role="tablist" aria-label="Catégories de réglages">${tabs.map(([id, name]) => `<button role="tab" id="tab-${id}" aria-selected="${id === tab}" aria-controls="panel-${id}" class="tab ${id === tab ? 'active' : ''}">${name}</button>`).join('')}</div>${tabs.map(([id]) => `<div class="tab-panel" role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" ${id === tab ? '' : 'hidden'}>${panels[id]}</div>`).join('')}<div class="settings-footer"><button id="reset-settings" class="text-button">Rétablir les valeurs par défaut</button></div></section>`;
    const show = (id: string): void => {
      for (const [other] of tabs) {
        const selected = other === id;
        this.root.querySelector(`#tab-${other}`)?.setAttribute('aria-selected', String(selected));
        this.root.querySelector(`#tab-${other}`)?.classList.toggle('active', selected);
        this.root.querySelector<HTMLElement>(`#panel-${other}`)!.hidden = !selected;
      }
      tab = id;
    };
    for (const [id] of tabs) this.bind(`tab-${id}`, () => show(id));
    const output = (input: HTMLInputElement): void => {
      const out = input.parentElement?.querySelector('output');
      if (!out) return;
      const value = Number(input.value);
      out.textContent =
        out.dataset.unit === 'percent' ? `${Math.round(value * 100)} %` : `${value.toFixed(2)}×`;
    };
    for (const key of [
      'master',
      'music',
      'effects',
      'brightness',
      'contrast',
      'shake',
      'cameraSensitivity',
    ] as const) {
      const input = this.root.querySelector<HTMLInputElement>('#' + key);
      if (!input) continue;
      output(input);
      input.addEventListener('input', () => {
        settings[key] = Number(input.value);
        output(input);
        this.actions.settings(settings);
      });
    }
    for (const key of [
      'reducedMotion',
      'chromaticAberration',
      'subtitles',
      'memoryToggle',
      'assist',
      'hints',
    ] as const)
      this.root.querySelector<HTMLInputElement>('#' + key)?.addEventListener('change', (event) => {
        settings[key] = (event.target as HTMLInputElement).checked;
        this.actions.settings(settings);
      });
    this.root.querySelector<HTMLSelectElement>('#preset')?.addEventListener('change', (event) => {
      settings.preset = (event.target as HTMLSelectElement).value as Settings['preset'];
      const info = this.root.querySelector('#preset-info');
      if (info) info.textContent = presetInfo[settings.preset];
      this.actions.settings(settings);
    });
    this.bind('reset-settings', () => {
      Object.assign(settings, defaultSettings());
      this.actions.settings(settings);
      this.settings(settings, back, tab);
    });
    this.root.querySelectorAll<HTMLButtonElement>('.binding').forEach((button) =>
      button.addEventListener('click', () => {
        this.cancelCapture();
        const action = button.dataset.action as InputAction;
        button.classList.add('capturing');
        button.querySelector('kbd')!.textContent = 'Appuyez…';
        this.keyCapture = (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.code !== 'Escape') {
            const effective = { ...defaultBindings, ...settings.bindings };
            const other = Object.values(InputAction).find(
              (a) => a !== action && effective[a] === event.code,
            );
            if (other) {
              settings.bindings[other] = effective[action];
              this.notice(`${actionLabels[other]} prend la touche ${keyLabel(effective[action])}.`);
            }
            settings.bindings[action] = event.code;
            this.actions.settings(settings);
          }
          this.cancelCapture();
          this.settings(settings, back, 'controls');
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
  dialogue(session: GameSession, label?: Label): void {
    const key = label ? label(InputAction.Interact) : 'E';
    this.root.innerHTML = `<div class="cinematic-bars"></div><section class="dialogue"><p class="eyebrow">${escape(session.narrative.speaker)}</p><p class="dialogue-line"></p><button id="advance" class="text-button">Continuer <kbd>${escape(key)}</kbd> →</button></section>`;
    const line = this.root.querySelector<HTMLElement>('.dialogue-line')!;
    this.stopTyping();
    if (this.reducedMotion) line.textContent = session.narrative.line;
    else {
      // Typewriter reveal; the first press completes the line, the next one advances.
      this.typing = { element: line, text: session.narrative.line, shown: 0 };
      const step = (): void => {
        if (!this.typing) return;
        this.typing.shown = Math.min(this.typing.text.length, this.typing.shown + 2);
        this.typing.element.textContent = this.typing.text.slice(0, this.typing.shown);
        if (this.typing.shown >= this.typing.text.length) this.stopTyping();
        else this.typeTimer = window.setTimeout(step, 28);
      };
      step();
    }
    this.bind('advance', this.actions.advance);
    this.focus();
  }
  /** Completes a line still being revealed. Returns false when nothing was typing. */
  finishLine(): boolean {
    if (!this.typing) return false;
    this.typing.element.textContent = this.typing.text;
    this.stopTyping();
    return true;
  }
  private stopTyping(): void {
    window.clearTimeout(this.typeTimer);
    this.typing = null;
  }
  /** The anchor altar: rest, save and trade shards for vitality. */
  altar(session: GameSession): void {
    const cost = session.inventory.offeringCost;
    const made = session.inventory.healthUpgrades;
    const shards = session.inventory.shards;
    const total = offeringData.costs.length;
    const offer =
      cost === null
        ? '<p class="altar-note">Toutes les offrandes ont été faites. La céramique ne peut porter davantage.</p>'
        : `<button id="offer" class="solid-button" ${shards < cost ? 'disabled' : ''}>Offrir ${cost} éclats — +${offeringData.vitality} vitalité</button>${shards < cost ? `<p class="altar-note">Il manque ${cost - shards} éclats. Les Veilleurs vaincus en laissent derrière eux.</p>` : ''}`;
    this.root.innerHTML = `<div class="modal-scrim rest-scrim"></div><section class="panel compact altar-panel"><p class="eyebrow">AUTEL DE L’ANCRAGE</p><h2>Le repos d’une mémoire.</h2><p>Santé et mémoire restaurées. Votre progression est enregistrée.</p><div class="altar-stats"><span><b>${session.actor.maxHealth}</b><small>VITALITÉ</small></span><span><b>◆ ${shards}</b><small>ÉCLATS</small></span><span><b>${made}/${total}</b><small>OFFRANDES</small></span></div>${offer}<button id="resume" class="text-button">Reprendre le voyage →</button></section>`;
    this.bind('offer', this.actions.offer);
    this.bind('resume', this.actions.resume);
    this.focus();
  }
  death(): void {
    this.root.innerHTML = `<div class="death-scrim"></div><section class="death-panel"><p class="eyebrow">CE N’EST PAS LA FIN</p><h2>La mémoire demeure.</h2><p>Votre dernier ancrage vous attend.</p><button id="respawn" class="solid-button">Se reconstituer →</button><button id="menu" class="text-button">Menu principal</button><p class="tip"><span>CONSEIL</span>${escape(tip())}</p></section>`;
    this.bind('respawn', this.actions.respawn);
    this.bind('menu', this.actions.menu);
    this.focus();
  }
  map(session: GameSession): void {
    const flags = session.narrative.flags;
    const width = chunks.at(-1)!.end;
    const markers = (start: number, end: number, sector: string): string => {
      const inside = (x: number) => x >= start && x < end;
      const icons: string[] = [];
      for (const c of checkpoints)
        if (inside(c.x))
          icons.push(
            `<i class="${c.id === session.checkpoint ? 'active' : ''}" title="${escape(c.name)}">◇</i>`,
          );
      for (const m of landmarks)
        if (inside(m.x) && m.kind !== 'npc')
          icons.push(
            `<i class="${session.inventory.collectibles.has(m.id) ? 'found' : ''}" title="${escape(m.label)}">${m.kind === 'memory' ? '❖' : '✦'}</i>`,
          );
      // Guardians and the sealed exit of each stage.
      if (inside(154))
        icons.push(
          `<i class="${session.defeated('keeper') ? 'found' : 'danger'}" title="Porteur du dernier ordre">☗</i>`,
        );
      if (inside(183))
        icons.push(
          `<i class="${session.enemies.bossDefeated ? 'found' : 'danger'}" title="Gardien Sans Visage">☗</i>`,
        );
      for (const stage of stages)
        if (stage.id === sector) {
          const open = flags.has(stageFlag(stage.id));
          icons.push(
            `<i class="${open ? 'found' : 'danger'}" title="${open ? 'Passage ouvert' : 'Passage scellé : vaincre les gardiens du secteur'}">${open ? '⊙' : '⊘'}</i>`,
          );
        }
      return icons.join('');
    };
    const nodes = chunks
      .map((c) => {
        const known = session.discovered.has(c.id);
        const here = session.actor.x >= c.start && session.actor.x < c.end;
        return `<li class="route-node ${known ? 'discovered' : ''} ${here ? 'current' : ''}"><span class="node-dot"></span><strong>${known ? escape(c.name) : 'INCONNU'}</strong><span class="node-icons">${known ? markers(c.start, c.end, c.id) : ''}</span></li>`;
      })
      .join('');
    const position = Math.max(0, Math.min(100, (session.actor.x / width) * 100));
    const shortcut = flags.has('echo-gate-open');
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel map-panel"><p class="eyebrow">CARTOGRAPHIE DE LA RÉMANENCE</p><h2>Le laboratoire de l’éveil</h2><div class="route"><div class="route-shortcut ${shortcut ? 'open' : ''}" title="Conduit de maintenance"><span>${shortcut ? 'Conduit de maintenance' : 'Passage scellé'}</span></div><div class="route-line"></div><div class="route-you" style="left:${position.toFixed(1)}%"><span>Eidra</span></div><ol class="route-nodes">${nodes}</ol></div><div class="map-key"><span>◇ Ancrage</span><span>✦ Pouvoir</span><span>❖ Fragment</span><span class="danger">☗ Gardien</span><span>⊘ Passage scellé</span><span class="mint">● Votre position</span></div><h3>Fragments retrouvés</h3><div class="memory-list">${['kael', 'seris', 'ilyan', 'vaela', 'deren', 'noa', 'aren'].map((id, i) => `<span class="${session.narrative.memories.has(id) ? 'found' : ''}"><b>0${i + 1}</b> ${session.narrative.memories.has(id) ? id.toUpperCase() : 'INCONNU'}</span>`).join('')}</div><p class="muted">◇ ${escape(session.quests.objective(flags))} · ◆ ${session.inventory.shards} éclats</p><button id="back" class="text-button">Reprendre le voyage →</button></section>`;
    this.bind('back', this.actions.resume);
    this.focus();
  }
  ending(session: GameSession): void {
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel compact"><p class="eyebrow">FIN DU PRÉLUDE</p><h2>Un ordre peut<br>être oublié.</h2><p>La porte de Nhalis est ouverte.<br>Les Failles de cendre attendent encore.</p><div class="end-stats"><span>${session.narrative.memories.size}/2<br><small>SOUVENIRS</small></span><span>${Math.floor(session.playtime / 60)} min<br><small>DE VOYAGE</small></span><span>◆ ${session.inventory.shards}<br><small>ÉCLATS</small></span></div><p class="muted small">Vous avez atteint la fin de ce prototype jouable. La suite de Nhalis est en développement.</p><button id="explore" class="solid-button">Revenir explorer →</button><button id="menu" class="text-button">Menu principal</button></section>`;
    this.bind('explore', this.actions.resume);
    this.bind('menu', this.actions.menu);
    this.focus();
  }
  loading(): void {
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="loading-screen"><div class="loading-sigil">${mark}</div><p class="eyebrow">NHALIS SE SOUVIENT</p><p class="tip"><span>CONSEIL</span>${escape(tip())}</p></section>`;
  }
  /** Stacked, self-dismissing notifications at the top of the screen. */
  notice(text: string): void {
    const box = this.overlay('toasts', 'toasts');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    box.prepend(toast);
    while (box.children.length > 3) box.lastElementChild?.remove();
    requestAnimationFrame(() => toast.classList.add('show'));
    const timer = window.setTimeout(() => {
      toast.classList.remove('show');
      const removal = window.setTimeout(() => {
        toast.remove();
        this.toastTimers.delete(removal);
      }, 400);
      this.toastTimers.add(removal);
      this.toastTimers.delete(timer);
    }, 4800);
    this.toastTimers.add(timer);
  }
  dispose(): void {
    this.cancelCapture();
    this.stopTyping();
    for (const timer of this.toastTimers) window.clearTimeout(timer);
    document.getElementById('toasts')?.remove();
    window.clearTimeout(this.captionTimer);
    window.clearTimeout(this.titleTimer);
    window.clearTimeout(this.bannerTimer);
    document.getElementById('audio-caption')?.remove();
    document.getElementById('title-card')?.remove();
    document.getElementById('ability-banner')?.remove();
    this.root.replaceChildren();
  }
}

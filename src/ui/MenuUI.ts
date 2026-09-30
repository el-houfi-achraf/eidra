import type { Settings } from '../config/settings';
import { InputAction, actionLabels, defaultBindings, keyLabel } from '../player/InputAction';
import type { MenuInput } from '../player/InputManager';
import type { PadInfo } from '../player/Gamepad';
import { defaultPadBindings, familyNames } from '../../game-data/input/controllers';
import type { PadFamily, PadToken } from '../../game-data/input/controllers';
import type { SaveData } from '../save/SaveManager';
import type { GameSession, TitleKind } from '../core/GameSession';
import {
  actAt,
  arenas,
  chunks,
  checkpoints,
  landmarks,
  route,
  stages,
} from '../../game-data/zones/laboratory';
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
  /** Waits for a controller input to remap; null when cancelled. */
  capturePad: (done: (token: PadToken | null) => void) => void;
  cancelPadCapture: () => void;
  /** The controller in hand and the glyph of a binding for it. */
  pad: () => { info: PadInfo | null; glyph: (token: PadToken | undefined) => string };
  rumbleTest: () => void;
}
/** Controller actions the player may remap; moving, aiming down and pause stay fixed. */
const padActions = [
  InputAction.Jump,
  InputAction.Attack,
  InputAction.Charge,
  InputAction.Heal,
  InputAction.Dash,
  InputAction.Parry,
  InputAction.Remanence,
  InputAction.Echo,
  InputAction.Interact,
  InputAction.Map,
] as const;
/** Inputs that keep their role: the stick directions used to move and aim, and start. */
const reservedPad: readonly PadToken[] = ['left', 'right', 'down', 'b9'];
const focusable = 'button:not(:disabled), input:not(:disabled), select:not(:disabled)';
const padStatus = (info: PadInfo | null): string =>
  info
    ? `Manette : ${info.name} · ${familyNames[info.family]}${info.profile?.id === 'generic' ? ' · disposition générique' : ''}`
    : 'Aucune manette active — branchez-en une et appuyez sur un bouton.';
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
  private padCapturing = false;
  private currentSettings: Settings | null = null;
  private reducedMotion = false;
  /** Latest input device, for the few prompts that differ between keyboard and pad. */
  private device: 'keyboard' | 'gamepad' = 'keyboard';
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
  /** Follows the device in hand: glyph style of the prompts and visible focus for pads. */
  setDevice(device: 'keyboard' | 'gamepad', family: PadFamily): void {
    this.device = device;
    if (document.body.dataset.device !== device) document.body.dataset.device = device;
    if (document.body.dataset.pad !== family) document.body.dataset.pad = family;
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
      '<div class="ingame"><div class="zone-label"><span id="act-name" class="tiny"></span><p id="zone-name"></p></div><div id="objective" class="objective"></div><div id="interaction" class="interaction"></div><div id="hint" class="hint" role="status" aria-live="polite"></div><div id="abilities" class="ability-dock"></div><div id="journal-hint" class="journal-hint"></div></div>';
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
    const act = this.root.querySelector('#act-name');
    const actName = actAt(session.actor.x).title.toUpperCase();
    if (act && act.textContent !== actName) act.textContent = actName;
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
    this.currentSettings = settings;
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
      ['gamepad', 'Manette'],
    ];
    const presetInfo: Record<Settings['preset'], string> = {
      LOW: 'Performances : sans étalonnage, ciel ni rayons',
      MEDIUM: 'Équilibré : étalonnage cinématique et FXAA',
      HIGH: 'Ombres et anti-crénelage MSAA',
      ULTRA: 'Résolution supérieure et ombres fines',
    };
    const pad = this.actions.pad();
    const padBindings = { ...defaultPadBindings, ...settings.padBindings } as Record<
      string,
      PadToken
    >;
    const families: [Settings['glyphs'], string][] = [
      ['auto', 'Automatique'],
      ...(Object.entries(familyNames) as [PadFamily, string][]),
    ];
    const padPanel = (): string =>
      `<p id="pad-status" class="pad-status ${pad.info ? 'connected' : ''}">${escape(padStatus(pad.info))}</p><label class="setting"><span>Symboles des boutons<small>Suivre la manette en main ou imposer une famille</small></span><select id="glyphs">${families.map(([id, name]) => `<option value="${id}" ${settings.glyphs === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label>${slider('deadzone', 'Zone morte du stick', 0.05, 0.5, 0.05, 'percent')}<div class="setting-with-action">${slider('vibration', 'Vibrations', 0, 1, 0.1, 'percent')}<button id="rumble-test" class="text-button">Tester</button></div><div class="bindings pad-bindings">${padActions.map((action) => `<button class="binding" data-pad-action="${action}"><span>${actionLabels[action]}</span><kbd>${escape(pad.glyph(padBindings[action]))}</kbd></button>`).join('')}</div><p class="muted small">Stick gauche ou croix : se déplacer (à mi-course pour marcher), bas pour viser. Start : pause. Pour réassigner, choisissez une action puis appuyez sur le bouton voulu ; Start annule.</p><button id="reset-pad" class="text-button">Rétablir la disposition manette</button>`;
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
        .join('')}</div><p class="muted small">La manette se règle dans l’onglet Manette.</p>`,
      gamepad: padPanel(),
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
      'deadzone',
      'vibration',
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
    this.root.querySelector<HTMLSelectElement>('#glyphs')?.addEventListener('change', (event) => {
      settings.glyphs = (event.target as HTMLSelectElement).value as Settings['glyphs'];
      this.actions.settings(settings);
      this.refreshPad();
    });
    this.bind('rumble-test', this.actions.rumbleTest);
    this.bind('reset-pad', () => {
      settings.padBindings = {};
      this.actions.settings(settings);
      this.settings(settings, back, 'gamepad');
      this.root.querySelector<HTMLElement>('#reset-pad')?.focus();
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-pad-action]').forEach((button) =>
      button.addEventListener('click', () => {
        if (this.padCapturing) return;
        this.cancelCapture();
        const action = button.dataset.padAction as InputAction;
        button.classList.add('capturing');
        button.querySelector('kbd')!.textContent = 'Appuyez…';
        this.padCapturing = true;
        this.actions.capturePad((token) => {
          this.padCapturing = false;
          const glyph = this.actions.pad().glyph;
          if (token && reservedPad.includes(token))
            this.notice(`${glyph(token)} reste réservé au déplacement et à la pause.`);
          else if (token) {
            const effective = { ...defaultPadBindings, ...settings.padBindings } as Record<
              string,
              PadToken
            >;
            const other = padActions.find((a) => a !== action && effective[a] === token);
            if (other && effective[action]) {
              settings.padBindings[other] = effective[action];
              this.notice(`${actionLabels[other]} prend ${glyph(effective[action])}.`);
            }
            settings.padBindings[action] = token;
            this.actions.settings(settings);
          }
          // Still in the controller tab: redraw it and keep the focus on the action.
          if (!this.root.querySelector('#pad-status')) return;
          this.settings(settings, back, 'gamepad');
          this.root.querySelector<HTMLElement>(`[data-pad-action="${action}"]`)?.focus();
        });
      }),
    );
    this.bind('reset-settings', () => {
      Object.assign(settings, defaultSettings());
      this.actions.settings(settings);
      this.settings(settings, back, tab);
    });
    // Keyboard bindings only: the controller's have their own capture below.
    this.root.querySelectorAll<HTMLButtonElement>('.binding[data-action]').forEach((button) =>
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
      if (this.padCapturing) this.actions.cancelPadCapture();
      this.returnTo();
    });
    this.focus();
  }
  /** Updates the controller tab when a pad is plugged in, removed or its glyphs change. */
  refreshPad(): void {
    const status = this.root.querySelector<HTMLElement>('#pad-status');
    if (!status || this.padCapturing) return;
    const pad = this.actions.pad();
    status.textContent = padStatus(pad.info);
    status.classList.toggle('connected', pad.info !== null);
    const settings = this.currentSettings;
    if (!settings) return;
    const bindings = { ...defaultPadBindings, ...settings.padBindings } as Record<string, PadToken>;
    this.root.querySelectorAll<HTMLElement>('[data-pad-action]').forEach((button) => {
      const kbd = button.querySelector('kbd');
      if (kbd) kbd.textContent = pad.glyph(bindings[button.dataset.padAction ?? '']);
    });
  }
  /**
   * Controller navigation of every menu: directions move the focus spatially, left
   * and right also adjust sliders and lists, the south button activates, the east
   * button goes back, the bumpers switch tabs.
   */
  navigate(menu: MenuInput): void {
    if (this.keyCapture || this.padCapturing) return;
    const focused = document.activeElement;
    const active =
      focused instanceof HTMLElement && focused !== document.body && this.root.contains(focused)
        ? focused
        : null;
    if (menu.back) {
      this.root.querySelector<HTMLButtonElement>('#back, #resume')?.click();
      return;
    }
    if (menu.previous || menu.next) {
      const tabs = [...this.root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      const index = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      const next = tabs[(index + (menu.next ? 1 : -1) + tabs.length) % tabs.length];
      next?.click();
      next?.focus();
      return;
    }
    if (!active) {
      if (menu.x || menu.y || menu.confirm) this.focus();
      return;
    }
    if (menu.x && active instanceof HTMLInputElement && active.type === 'range') {
      const step = Number(active.step) || 0.1;
      const value = Math.max(
        Number(active.min),
        Math.min(Number(active.max), Number(active.value) + menu.x * step),
      );
      active.value = String(Math.round(value / step) * step);
      active.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (menu.x && active instanceof HTMLSelectElement) {
      this.cycle(active, menu.x);
      return;
    }
    if (menu.x || menu.y) this.move(active, menu.x, menu.y);
    else if (menu.confirm) {
      if (active instanceof HTMLSelectElement) this.cycle(active, 1);
      else if (!(active instanceof HTMLInputElement && active.type === 'range')) active.click();
    }
  }
  private cycle(select: HTMLSelectElement, direction: number): void {
    const count = select.options.length;
    select.selectedIndex = (select.selectedIndex + direction + count) % count;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  /** Moves the focus to the nearest control in a direction, wrapping vertically. */
  private move(from: HTMLElement, x: number, y: number): void {
    const items = [...this.root.querySelectorAll<HTMLElement>(focusable)].filter(
      (el) => el.offsetParent !== null,
    );
    const a = from.getBoundingClientRect();
    const ax = a.left + a.width / 2,
      ay = a.top + a.height / 2;
    let best: HTMLElement | undefined;
    let score = Number.POSITIVE_INFINITY;
    for (const el of items) {
      if (el === from) continue;
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - ax,
        dy = r.top + r.height / 2 - ay;
      const along = x ? dx * x : dy * y;
      if (along <= 4) continue;
      const value = along + (x ? Math.abs(dy) : Math.abs(dx)) * 2.5;
      if (value < score) {
        score = value;
        best = el;
      }
    }
    if (!best && y) best = y > 0 ? items[0] : items.at(-1);
    best?.focus();
    best?.scrollIntoView({ block: 'nearest' });
  }
  private cancelCapture(): void {
    if (this.keyCapture) {
      window.removeEventListener('keydown', this.keyCapture, true);
      this.keyCapture = null;
    }
  }
  dialogue(session: GameSession, label?: Label): void {
    // On a pad, the south button advances; on a keyboard, the interaction key.
    const key = label
      ? label(this.device === 'gamepad' ? InputAction.Jump : InputAction.Interact)
      : 'E';
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
    // The map shows the act Eidra is in.
    const act = actAt(session.actor.x);
    const next = route.acts[route.acts.indexOf(act) + 1];
    const sectors = chunks.filter((c) => c.start >= act.from && (!next || c.start < next.from));
    const left = sectors[0]!.start;
    const width = sectors.at(-1)!.end - left;
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
      // Guardians of the arenas and the sealed exit of each stage.
      for (const arena of arenas)
        if (inside((arena.left + arena.right) / 2))
          icons.push(
            `<i class="${session.defeated(arena.guardian) ? 'found' : 'danger'}" title="${escape(arena.name)}">☗</i>`,
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
    const nodes = sectors
      .map((c) => {
        const known = session.discovered.has(c.id);
        const here = session.actor.x >= c.start && session.actor.x < c.end;
        return `<li class="route-node ${known ? 'discovered' : ''} ${here ? 'current' : ''}"><span class="node-dot"></span><strong>${known ? escape(c.name) : 'INCONNU'}</strong><span class="node-icons">${known ? markers(c.start, c.end, c.id) : ''}</span></li>`;
      })
      .join('');
    const position = Math.max(0, Math.min(100, ((session.actor.x - left) / width) * 100));
    const shortcut = flags.has('echo-gate-open');
    // The maintenance duct only exists in the laboratory.
    const duct =
      act.from === 0
        ? `<div class="route-shortcut ${shortcut ? 'open' : ''}" title="Conduit de maintenance"><span>${shortcut ? 'Conduit de maintenance' : 'Passage scellé'}</span></div>`
        : '';
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel map-panel"><p class="eyebrow">CARTOGRAPHIE DE LA RÉMANENCE</p><h2>${escape(act.title)}</h2><div class="route">${duct}<div class="route-line"></div><div class="route-you" style="left:${position.toFixed(1)}%"><span>Eidra</span></div><ol class="route-nodes">${nodes}</ol></div><div class="map-key"><span>◇ Ancrage</span><span>✦ Pouvoir</span><span>❖ Fragment</span><span class="danger">☗ Gardien</span><span>⊘ Passage scellé</span><span class="mint">● Votre position</span></div><h3>Fragments retrouvés</h3><div class="memory-list">${['kael', 'seris', 'ilyan', 'vaela', 'deren', 'noa', 'aren'].map((id, i) => `<span class="${session.narrative.memories.has(id) ? 'found' : ''}"><b>0${i + 1}</b> ${session.narrative.memories.has(id) ? id.toUpperCase() : 'INCONNU'}</span>`).join('')}</div><p class="muted">◇ ${escape(session.quests.objective(flags))} · ◆ ${session.inventory.shards} éclats</p><button id="back" class="text-button">Reprendre le voyage →</button></section>`;
    this.bind('back', this.actions.resume);
    this.focus();
  }
  ending(session: GameSession): void {
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel compact"><p class="eyebrow">FIN DE L’ACTE II</p><h2>Un ordre peut<br>être oublié.</h2><p>Ilyra a ouvert les yeux.<br>Au-delà du jardin, Nhalis se souvient.</p><div class="end-stats"><span>${session.narrative.memories.size}/${landmarks.filter((l) => l.kind === 'memory').length}<br><small>SOUVENIRS</small></span><span>${Math.floor(session.playtime / 60)} min<br><small>DE VOYAGE</small></span><span>◆ ${session.inventory.shards}<br><small>ÉCLATS</small></span></div><p class="muted small">Vous avez traversé les deux actes de cette version. La suite de Nhalis est en développement.</p><button id="explore" class="solid-button">Revenir explorer →</button><button id="menu" class="text-button">Menu principal</button></section>`;
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

import type { Settings } from '../config/settings';
import { InputAction, actionLabels, defaultBindings, keyLabel } from '../player/InputAction';
import type { MenuInput } from '../player/InputManager';
import type { PadInfo } from '../player/Gamepad';
import { defaultPadBindings, familyNames } from '../../game-data/input/controllers';
import type { PadFamily, PadToken } from '../../game-data/input/controllers';
import type { SaveData } from '../save/SaveManager';
import type { GameSession, TitleKind } from '../core/GameSession';
import { actAt, chunks, checkpoints, landmarks, stages } from '../../game-data/zones/laboratory';
import { stageFlag } from '../quests/StageProgress';
import { defaultSettings } from '../config/settings';
import { offeringData } from '../../game-data/items/offerings';
import { cardData, focusData } from '../../game-data/abilities/abilities';
import { chapterAt, credits, news, titleMood, titleScreen } from '../../game-data/ui/title';
import type { Chapter } from '../../game-data/ui/title';
import { moods } from '../../game-data/zones/moods';
import { dialogues, fundamentalMemories } from '../../game-data/dialogue/story';
import { musicTracks } from '../../game-data/audio/music';
import type { TrackId } from '../../game-data/audio/music';
import { bossRoster } from '../../game-data/bosses/roster';
import { titleProgress, trackOrigin } from './TitleProgress';
import type { TitleProgress } from './TitleProgress';
import { icons, thumbnail } from './TitleArt';
import { actOf, bestiary, memories, roomMap, roomsOf } from './Journal';
import { sentence } from '../core/text';
import type { IconId } from './TitleArt';
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
  /** Plays a theme of the score in the menus; null brings back the title theme. */
  listen: (theme: TrackId | null) => void;
  /** Flies the camera over a chapter behind the title; `done` when the flight ends. */
  preview: (chapter: Chapter, done: () => void) => void;
  endPreview: () => void;
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
type Section = 'home' | 'play' | 'settings' | 'extras';
const sections: [Section, string][] = [
  ['home', 'Accueil'],
  ['play', 'Jouer'],
  ['settings', 'Paramètres'],
  ['extras', 'Extras'],
];
/** At most this many notifications on screen, each for this long (ms). */
const MAX_TOASTS = 2;
const TOAST_LIFE = 4200;
/** The preview card turns to its next slide after this long (ms). */
const SLIDE_EVERY = 7000;
const pad2 = (n: number): string => String(n).padStart(2, '0');
/** The latest news the bell has shown, kept in this browser. */
const NEWS_KEY = 'eidra.news.seen';
const seenNews = (): string | null => {
  try {
    return localStorage.getItem(NEWS_KEY);
  } catch (error) {
    // Storage blocked (private window): the bell simply keeps its dot.
    console.warn('[EIDRA] News state unavailable', error);
    return null;
  }
};
const markNewsSeen = (): void => {
  try {
    localStorage.setItem(NEWS_KEY, news[0]?.id ?? '');
  } catch (error) {
    console.warn('[EIDRA] News state not kept', error);
  }
};
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
    cast: [label(InputAction.Heal)],
    remanence: [label(InputAction.Remanence)],
    echo: [label(InputAction.Echo)],
    down: [label(InputAction.Down), label(InputAction.Attack)],
  })[action] ?? [];
const controls: [InputAction, string][] = [
  [InputAction.Jump, 'Sauter'],
  [InputAction.Attack, 'Frapper'],
  [InputAction.Parry, 'Parer'],
  [InputAction.Dash, 'Élan'],
  [InputAction.Heal, 'Carte (toucher) · soin (maintenir)'],
  [InputAction.Remanence, 'Rémanence'],
  [InputAction.Echo, 'Écho mémoriel'],
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
  private family: PadFamily | null = null;
  /** The title screen's saves, settings and what they tell of the journey. */
  private front: {
    saves: (SaveData | null)[];
    settings: Settings;
    progress: TitleProgress;
  } | null = null;
  private slide = 0;
  private slideTimer = 0;
  /** Theme chosen on the soundtrack page, if any. */
  private listening: TrackId | null = null;
  private keyboard = new AbortController();
  constructor(private actions: MenuActions) {
    this.root = document.getElementById('interface')!;
    window.addEventListener('keydown', (event) => this.titleKey(event), {
      signal: this.keyboard.signal,
    });
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
    const changed = device !== this.device || family !== this.family;
    this.device = device;
    this.family = family;
    if (document.body.dataset.device !== device) document.body.dataset.device = device;
    if (document.body.dataset.pad !== family) document.body.dataset.pad = family;
    const keys = changed ? this.root.querySelector('.title-keys') : null;
    if (keys) keys.innerHTML = this.keyHints();
  }
  /** Cinematic card for a new area, a boss introduction or a victory. */
  title(kind: TitleKind, title: string, subtitle: string): void {
    const el = this.overlay('title-card', 'title-card');
    // An area name never interrupts a boss introduction, a victory card or a new power.
    const banner = document.getElementById('ability-banner')?.classList.contains('show');
    if (
      kind === 'area' &&
      ((el.classList.contains('show') && !el.classList.contains('area')) || banner)
    )
      return;
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
    // Under a large card, a single notification stays: a second would run into it.
    this.trimToasts();
  }
  /** Notifications allowed at once: one while a large card shows, else two. */
  private get toastRoom(): number {
    return document.getElementById('title-card')?.classList.contains('show') ? 1 : MAX_TOASTS;
  }
  private trimToasts(): void {
    const box = document.getElementById('toasts');
    if (!box) return;
    const live = ([...box.children] as HTMLElement[]).filter((t) => !t.dataset.leaving);
    for (const toast of live.slice(this.toastRoom)) this.dropToast(toast);
  }
  /** Large banner when a memory power is recovered, with its control prompt. */
  abilityBanner(name: string, description: string, key: string): void {
    const el = this.overlay('ability-banner', 'ability-banner');
    // A new power takes the stage: an area name showing at the same time steps aside.
    const card = document.getElementById('title-card');
    if (card?.classList.contains('area')) card.classList.remove('show');
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
  /** Focuses what the page offers first: its marked default, else its first button. */
  private focus(): void {
    (
      this.root.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)') ??
      this.root.querySelector<HTMLElement>('.title-page button:not(:disabled)') ??
      this.root.querySelector<HTMLElement>('button:not(:disabled)')
    )?.focus();
  }
  main(saves: (SaveData | null)[], settings: Settings): void {
    this.front = { saves, settings, progress: titleProgress(saves) };
    this.slide = 0;
    this.home();
  }
  /**
   * The title screen keeps a frame of its own: a bar of sections at the top
   * (home, play, settings, extras), the progress and the keys in hand at the
   * bottom; only the page between them changes.
   */
  private shell(section: Section, content: string): void {
    const { settings, progress } = this.front!;
    window.clearTimeout(this.slideTimer);
    this.root.innerHTML = `<div class="title-shell" data-page="${section}"><div class="title-shade" aria-hidden="true"></div><header class="title-bar"><span class="title-brand">${icons.emblem}<span>EIDRA</span></span><nav class="title-nav" aria-label="Sections">${sections
      .map(
        ([id, name]) =>
          `<button data-section="${id}" ${id === section ? 'aria-current="page"' : ''}>${name}</button>`,
      )
      .join(
        '',
      )}</nav><div class="title-tools"><button id="quick-settings" class="icon-button" aria-label="Ouvrir les réglages" title="Réglages">${icons.gear}</button><button id="news" class="icon-button" aria-label="Nouveautés" title="Nouveautés" aria-expanded="false" aria-controls="title-pop">${icons.bell}${seenNews() === news[0]?.id ? '' : '<i class="unread"></i>'}</button><span class="tools-rule" aria-hidden="true"></span><button id="profile" class="profile-chip" aria-label="Profil : ${escape(settings.profileName)}" aria-expanded="false" aria-controls="title-pop"><span class="avatar">${icons.mask}</span><span class="profile-text"><strong>${escape(settings.profileName)}</strong><small><i></i>Profil local</small></span></button></div></header><main class="title-page">${content}</main><footer class="title-footer"><span class="fragments" title="Fragments de la partie la plus récente">${icons.emblem}<b>${pad2(progress.fragments)}</b><em>/</em><span>${pad2(progress.total)}</span><small>Fragments trouvés</small></span><span class="title-keys">${this.keyHints()}</span></footer></div>`;
    this.root
      .querySelectorAll<HTMLButtonElement>('.title-nav [data-section]')
      .forEach((button) =>
        button.addEventListener('click', () => this.go(button.dataset.section as Section)),
      );
    this.bind('quick-settings', () => this.go('settings'));
    this.bind('news', () => this.popover('news'));
    this.bind('profile', () => this.popover('profile'));
  }
  private go(section: Section): void {
    const t = this.front;
    if (!t) return;
    if (section === 'home') this.home();
    else if (section === 'play') this.slots(!t.progress.latest);
    else if (section === 'settings') this.settings(t.settings, () => this.home());
    else this.extras();
  }
  private home(): void {
    const { progress } = this.front!;
    const latest = progress.latest;
    const chapter = progress.chapter;
    const action = (id: string, icon: IconId, label: string, primary: boolean, extra = '') =>
      `<button id="${id}" class="title-action${primary ? ' primary' : ''}" ${primary ? 'data-autofocus' : ''} ${extra}><i class="glyph">${icons[icon]}</i><span>${label}</span>${primary ? `<i class="go">${icons.arrow}</i>` : ''}</button>`;
    const resume = latest
      ? `<button id="continue" class="title-action primary" data-autofocus aria-label="Continuer" aria-describedby="continue-detail"><i class="glyph">${icons.diamond}</i><span>Continuer<small id="continue-detail">${escape(anchorName(latest.checkpoint))} · ${duration(latest.playtime)} · ${ago(latest.savedAt)}</small></span><i class="go">${icons.arrow}</i></button>`
      : '';
    this.shell(
      'home',
      `<section class="title-hero"><h1 class="title-word" aria-label="EIDRA"><span aria-hidden="true">EIDR</span><span class="title-a" aria-hidden="true">A<i class="title-spark">${icons.sparkle}</i></span></h1><p class="title-sub"><i></i><span>${escape(titleScreen.subtitle)}</span><i></i></p><p class="title-tagline">${escape(titleScreen.tagline)}</p><nav class="title-menu" aria-label="Menu principal">${resume}${action('new', 'diamond', 'Nouvelle partie', !latest)}${action('load', 'folder', 'Charger une partie', false, latest ? '' : 'disabled')}${action('settings', 'gear', 'Réglages', false)}</nav></section><aside class="chapter-card" aria-label="Chapitre en cours"><span class="chapter-rule" aria-hidden="true"><i></i></span><p class="tiny">CHAPITRE ${chapter.number}</p><h2>${escape(chapter.title)}</h2><p>${escape(chapter.tagline)}</p></aside>${this.carousel()}`,
    );
    this.bind('continue', () => {
      if (latest) this.actions.load(latest);
    });
    this.bind('new', () => this.slots(true));
    this.bind('load', () => this.slots(false));
    this.bind('settings', () => this.go('settings'));
    this.wireCarousel();
    this.focus();
  }
  /** What the bottom-right card offers in turn: each chapter reached, the score, the news. */
  private slides(): {
    eyebrow: string;
    title: string;
    label: string;
    art: string;
    run: () => void;
  }[] {
    const { progress } = this.front!;
    const chapterSlides = progress.reached.map((chapter) => ({
      eyebrow: `Chapitre ${chapter.number}`,
      title: chapter.title,
      label: `Voir l’aperçu du chapitre ${chapter.number}`,
      art: thumbnail(moods[chapter.sector] ?? titleMood, chapter.id, 'chapter'),
      run: () => this.preview(chapter),
    }));
    const count = progress.themes.length;
    return [
      ...chapterSlides,
      {
        eyebrow: 'Bande originale',
        title: `${count} thème${count > 1 ? 's' : ''} retrouvé${count > 1 ? 's' : ''}`,
        label: 'Écouter la bande originale',
        art: thumbnail(moods['ember-fields'] ?? titleMood, 'score', 'score'),
        run: () => this.extras('score'),
      },
      {
        eyebrow: 'Nouveautés',
        title: news[0]?.title ?? 'Rien de nouveau',
        label: 'Lire les nouveautés',
        art: thumbnail(moods['denial-garden'] ?? titleMood, 'news', 'news'),
        run: () => this.popover('news'),
      },
    ];
  }
  private carousel(): string {
    const slides = this.slides();
    this.slide %= slides.length;
    return `<aside class="preview-card" aria-roledescription="carrousel" aria-label="Aperçus"><div class="preview-slides">${slides
      .map(
        (s, i) =>
          `<article class="preview-slide" data-index="${i}" aria-roledescription="diapositive" aria-label="${i + 1} sur ${slides.length}" ${i === this.slide ? '' : 'hidden'}><div class="preview-thumb">${s.art}<button class="preview-play" data-run="${i}" aria-label="${escape(s.label)}">${icons.play}</button></div><div class="preview-text"><p class="tiny">${escape(s.eyebrow)}</p><h3>${escape(s.title)}</h3></div></article>`,
      )
      .join(
        '',
      )}</div><div class="preview-dots">${slides.map((_, i) => `<button class="dot" data-slide="${i}" aria-label="Aperçu ${i + 1}" ${i === this.slide ? 'aria-current="true"' : ''}></button>`).join('')}</div></aside>`;
  }
  private wireCarousel(): void {
    const slides = this.slides();
    const card = this.root.querySelector<HTMLElement>('.preview-card');
    if (!card) return;
    const show = (index: number): void => {
      this.slide = (index + slides.length) % slides.length;
      card.querySelectorAll<HTMLElement>('.preview-slide').forEach((el) => {
        el.hidden = Number(el.dataset.index) !== this.slide;
      });
      card.querySelectorAll<HTMLElement>('[data-slide]').forEach((dot) => {
        if (Number(dot.dataset.slide) === this.slide) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    };
    card
      .querySelectorAll<HTMLButtonElement>('[data-run]')
      .forEach((button) =>
        button.addEventListener('click', () => slides[Number(button.dataset.run)]?.run()),
      );
    card
      .querySelectorAll<HTMLButtonElement>('[data-slide]')
      .forEach((dot) => dot.addEventListener('click', () => show(Number(dot.dataset.slide))));
    // Turns by itself, unless motion is reduced or the player is looking at it.
    const turn = (): void => {
      if (!card.isConnected) return;
      if (!card.matches(':hover, :focus-within')) show(this.slide + 1);
      this.slideTimer = window.setTimeout(turn, SLIDE_EVERY);
    };
    if (!this.reducedMotion) this.slideTimer = window.setTimeout(turn, SLIDE_EVERY);
  }
  /** Flies over a chapter, its theme playing, the interface drawn aside. */
  private preview(chapter: Chapter): void {
    const shell = this.root.querySelector<HTMLElement>('.title-shell');
    if (!shell) return;
    window.clearTimeout(this.slideTimer);
    this.closePopover();
    shell.classList.add('previewing');
    shell.insertAdjacentHTML(
      'beforeend',
      `<div class="cinematic-bars" aria-hidden="true"></div><div class="preview-caption" role="status"><p class="tiny">APERÇU · CHAPITRE ${chapter.number}</p><h2>${escape(chapter.title)}</h2><p>${escape(chapter.tagline)}</p><button id="back" class="text-button">${icons.back}<span>Revenir au titre</span></button></div>`,
    );
    this.bind('back', () => {
      this.actions.endPreview();
      this.home();
    });
    this.root.querySelector<HTMLElement>('.preview-caption #back')?.focus();
    this.listening = null;
    this.actions.preview(chapter, () => {
      if (this.root.querySelector('.title-shell.previewing')) this.home();
    });
  }
  private slots(create: boolean): void {
    const { saves, progress } = this.front!;
    const autofocus = saves.findIndex((save) => (create ? true : save !== null));
    this.shell(
      'play',
      `<section class="panel title-panel play-panel"><div class="panel-heading"><div><p class="eyebrow">LES ANCRAGES</p><h2>${create ? 'Une nouvelle mémoire' : 'Retrouver une mémoire'}</h2></div><button id="back" class="text-button">${icons.back}<span>Retour</span></button></div><div class="tabs" role="tablist" aria-label="Jouer"><button role="tab" id="tab-load" aria-selected="${!create}" class="tab ${create ? '' : 'active'}" ${progress.latest ? '' : 'disabled'}>Charger</button><button role="tab" id="tab-create" aria-selected="${create}" class="tab ${create ? 'active' : ''}">Nouvelle partie</button></div><p class="muted">Trois emplacements, conservés dans ce navigateur.</p><div class="slots">${saves
        .map((save, i) =>
          save
            ? `<button class="slot filled" id="slot-${i}" ${i === autofocus ? 'data-autofocus' : ''}><span class="slot-number">0${i + 1}</span><span class="slot-body"><strong>${escape(anchorName(save.checkpoint))}</strong><small>${escape(chapterAt(save.position.x).title)} · ${ago(save.savedAt)}</small><span class="slot-stats"><i title="Temps de jeu">◷ ${duration(save.playtime)}</i><i title="Vitalité">♥ ${100 + save.healthUpgrades * 20}</i><i title="Éclats">◆ ${save.shards}</i><i title="Souvenirs">❖ ${save.memories.length}/7</i><i title="Pouvoirs">✦ ${save.abilities.length}</i></span></span><b aria-hidden="true">${create ? '↺' : '→'}</b></button>`
            : `<button class="slot" id="slot-${i}" ${create ? '' : 'disabled'} ${i === autofocus ? 'data-autofocus' : ''}><span class="slot-number">0${i + 1}</span><span class="slot-body"><strong>Emplacement libre</strong><small>${create ? 'Commencer le voyage' : 'Aucune mémoire ici'}</small></span><b aria-hidden="true">${create ? '+' : ''}</b></button>`,
        )
        .join('')}</div></section>`,
    );
    this.bind('tab-load', () => this.slots(false));
    this.bind('tab-create', () => this.slots(true));
    saves.forEach((save, i) =>
      this.bind(`slot-${i}`, () => {
        if (create && save) this.confirmOverwrite(i + 1, () => this.slots(create));
        else if (create) this.actions.start(i + 1);
        else if (save) this.actions.load(save);
      }),
    );
    this.bind('back', () => this.home());
    this.focus();
  }
  private confirmOverwrite(slot: number, back: () => void): void {
    this.shell(
      'play',
      `<section class="panel title-panel compact"><p class="eyebrow">EMPLACEMENT 0${slot}</p><h2>Remplacer cette mémoire ?</h2><p>La progression précédente de cet emplacement sera remplacée.</p><button class="solid-button" id="replace">Remplacer et commencer</button><button class="text-button" id="back" data-autofocus>Conserver ma partie</button></section>`,
    );
    this.bind('replace', () => this.actions.start(slot));
    this.bind('back', back);
    this.focus();
  }
  /** Memories once recovered, the themes heard so far and the credits. */
  private extras(tab: 'memories' | 'score' | 'credits' = 'memories'): void {
    const { progress } = this.front!;
    const tabs: [typeof tab, string][] = [
      ['memories', 'Souvenirs'],
      ['score', 'Bande originale'],
      ['credits', 'Crédits'],
    ];
    const lines = dialogues as Partial<Record<string, { speaker: string; lines: string[] }>>;
    const memories = fundamentalMemories
      .map((id, i) => {
        const found = progress.memories.has(id) ? lines[id] : undefined;
        return found
          ? `<li class="found"><b>${pad2(i + 1)}</b><div><strong>${escape(found.speaker)}</strong><q>${escape(found.lines[0]!.replace(/^«\s*|\s*»$/g, ''))}</q></div></li>`
          : `<li><b>${pad2(i + 1)}</b><div><strong>Fragment inconnu</strong><span>Quelque part, quelqu’un attend encore.</span></div></li>`;
      })
      .join('');
    const tracks = (Object.keys(musicTracks) as TrackId[])
      .map((id) => {
        const known = progress.themes.includes(id);
        const playing = this.listening === id;
        return known
          ? `<li><button class="track" data-theme="${id}" aria-pressed="${playing}"><i class="glyph">${playing ? icons.pause : icons.play}</i><span><strong>${escape(musicTracks[id].title)}</strong><small>${escape(trackOrigin(id))}</small></span></button></li>`
          : `<li><button class="track" disabled><i class="glyph">${icons.lock}</i><span><strong>Thème inconnu</strong><small>Il attend plus loin sur la route.</small></span></button></li>`;
      })
      .join('');
    const panels: Record<typeof tab, string> = {
      memories: `<p class="muted">${progress.memories.size} / ${fundamentalMemories.length} fragments retrouvés dans vos parties.</p><ol class="memory-gallery">${memories}</ol>`,
      score: `<p class="muted">Les thèmes déjà entendus dans vos parties. Le titre reprend le sien quand vous arrêtez l’écoute.</p><ul class="track-list">${tracks}</ul>`,
      credits: `<dl class="credits">${credits.map(([role, who]) => `<dt>${escape(role)}</dt><dd>${escape(who)}</dd>`).join('')}</dl>`,
    };
    this.shell(
      'extras',
      `<section class="panel title-panel extras-panel"><div class="panel-heading"><div><p class="eyebrow">CE QUE NHALIS GARDE</p><h2>Extras</h2></div><button id="back" class="text-button">${icons.back}<span>Retour</span></button></div><div class="tabs" role="tablist" aria-label="Extras">${tabs.map(([id, name]) => `<button role="tab" id="tab-${id}" aria-selected="${id === tab}" aria-controls="panel-${id}" class="tab ${id === tab ? 'active' : ''}">${name}</button>`).join('')}</div>${tabs.map(([id]) => `<div class="tab-panel" role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" ${id === tab ? '' : 'hidden'}>${panels[id]}</div>`).join('')}</section>`,
    );
    for (const [id] of tabs) this.bind(`tab-${id}`, () => this.extras(id));
    this.root.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((button) =>
      button.addEventListener('click', () => {
        const id = button.dataset.theme as TrackId;
        this.listening = this.listening === id ? null : id;
        this.actions.listen(this.listening);
        this.extras('score');
        this.root.querySelector<HTMLElement>(`[data-theme="${id}"]`)?.focus();
      }),
    );
    this.bind('back', () => this.home());
    this.root.querySelector<HTMLElement>(`#tab-${tab}`)?.focus();
  }
  /** The bell's news, or the profile: a small panel under the top bar. */
  private popover(kind: 'news' | 'profile'): void {
    const open = this.root.querySelector<HTMLElement>('#title-pop');
    const was = open?.dataset.kind;
    this.closePopover();
    if (was === kind) return;
    const shell = this.root.querySelector<HTMLElement>('.title-shell');
    const t = this.front;
    if (!shell || !t) return;
    const trigger = this.root.querySelector<HTMLElement>(`#${kind}`);
    trigger?.setAttribute('aria-expanded', 'true');
    if (kind === 'news') {
      shell.insertAdjacentHTML(
        'beforeend',
        `<section id="title-pop" class="title-pop news-pop" data-kind="news" aria-label="Nouveautés"><p class="eyebrow">NOUVEAUTÉS</p><ul>${news.map((item) => `<li><strong>${escape(item.title)}</strong><span>${escape(item.text)}</span></li>`).join('')}</ul><button id="close-pop" class="text-button">Fermer</button></section>`,
      );
      markNewsSeen();
      this.root.querySelector('#news .unread')?.remove();
    } else {
      const filled = t.saves.filter((s): s is SaveData => s !== null);
      const playtime = filled.reduce((sum, s) => sum + s.playtime, 0);
      const bosses = new Set(filled.flatMap((s) => s.bosses)).size;
      shell.insertAdjacentHTML(
        'beforeend',
        `<section id="title-pop" class="title-pop profile-pop" data-kind="profile" aria-label="Profil"><p class="eyebrow">PROFIL LOCAL</p><label class="setting"><span>Nom du voyageur<small>Affiché sur cet écran, gardé sur cet appareil</small></span><input id="profile-name" type="text" maxlength="20" autocomplete="nickname" spellcheck="false" value="${escape(t.settings.profileName)}"></label><div class="profile-stats"><span><b>${duration(playtime)}</b><small>DE VOYAGE</small></span><span><b>${t.progress.memories.size}/${fundamentalMemories.length}</b><small>FRAGMENTS</small></span><span><b>${bosses}/${bossRoster.length}</b><small>GARDIENS APAISÉS</small></span><span><b>${filled.length}/3</b><small>ANCRAGES</small></span></div><button id="close-pop" class="text-button">Fermer</button></section>`,
      );
      const input = this.root.querySelector<HTMLInputElement>('#profile-name');
      input?.addEventListener('change', () => {
        const name = input.value.trim().slice(0, 20) || defaultSettings().profileName;
        t.settings.profileName = name;
        input.value = name;
        this.actions.settings(t.settings);
        const chip = this.root.querySelector<HTMLElement>('#profile');
        chip?.setAttribute('aria-label', `Profil : ${name}`);
        const label = chip?.querySelector('strong');
        if (label) label.textContent = name;
      });
      input?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
      });
    }
    this.bind('close-pop', () => this.closePopover(true));
    this.root.querySelector<HTMLElement>('#title-pop input, #title-pop button')?.focus();
  }
  /** Closes the open panel, if any; true when one was open. */
  private closePopover(refocus = false): boolean {
    const pop = this.root.querySelector<HTMLElement>('#title-pop');
    if (!pop) return false;
    const kind = pop.dataset.kind ?? '';
    pop.remove();
    const trigger = this.root.querySelector<HTMLElement>(`#${kind}`);
    trigger?.setAttribute('aria-expanded', 'false');
    if (refocus) trigger?.focus();
    return true;
  }
  /** The two keys the footer teaches, on the device in hand. */
  private keyHints(): string {
    const pad = this.device === 'gamepad' ? this.actions.pad() : null;
    const settings = this.front?.settings;
    const select = pad
      ? pad.glyph('b0')
      : keyLabel(settings?.bindings[InputAction.Interact] ?? defaultBindings[InputAction.Interact]);
    const back = pad ? pad.glyph('b1') : keyLabel('Escape');
    return `<kbd>${escape(select)}</kbd><span>Sélectionner</span><kbd>${escape(back)}</kbd><span>Retour</span>`;
  }
  /**
   * Keyboard play of the title screen, as the footer promises: arrows move the
   * focus, the interaction key selects, Escape goes back. Tab and Enter still work.
   */
  private titleKey(event: KeyboardEvent): void {
    if (!this.root.querySelector('.title-shell') || this.keyCapture || this.padCapturing) return;
    const target = event.target;
    const active =
      target instanceof HTMLElement && target !== document.body && this.root.contains(target)
        ? target
        : null;
    if (event.code === 'Escape') {
      event.preventDefault();
      this.back();
      return;
    }
    if (active instanceof HTMLInputElement && active.type === 'text') return;
    const direction = (
      {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      } as Record<string, [number, number]>
    )[event.code];
    if (direction) {
      const [x, y] = direction;
      // Sliders and lists keep left and right for their value.
      if (x && active instanceof HTMLInputElement && active.type === 'range') return;
      event.preventDefault();
      if (x && active instanceof HTMLSelectElement) this.cycle(active, x);
      else if (active) this.move(active, x, y);
      else this.focus();
      return;
    }
    const settings = this.front?.settings;
    const select =
      settings?.bindings[InputAction.Interact] ?? defaultBindings[InputAction.Interact];
    if (event.code === select && active?.matches('button, input[type="checkbox"]')) {
      event.preventDefault();
      active.click();
    }
  }
  /** Back, on the title screen: close a panel, else leave the page. */
  private back(): void {
    if (this.closePopover(true)) return;
    this.root.querySelector<HTMLButtonElement>('#back, #resume')?.click();
  }
  playing(): void {
    window.clearTimeout(this.slideTimer);
    this.listening = null;
    this.root.innerHTML =
      '<div class="ingame"><div class="zone-label"><span id="act-name" class="tiny"></span><p id="zone-name"></p></div><div id="objective" class="objective"></div><div id="interaction" class="interaction"></div><div id="hint" class="hint" role="status" aria-live="polite"></div><div id="abilities" class="ability-dock"></div><div id="journal-hint" class="journal-hint"></div></div>';
  }
  update(session: GameSession, label: Label, showHints = true): void {
    const hintEl = this.root.querySelector<HTMLElement>('#hint');
    // One prompt at a time: what Eidra can do here outranks a lesson.
    const hint = showHints && !session.interaction ? session.hint : null;
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
      journal.innerHTML = `<kbd>${escape(label(InputAction.Map))}</kbd><span>Journal</span><kbd>${escape(label(InputAction.Pause))}</kbd><span>Pause</span>`;
    }
    const abilities = this.root.querySelector('#abilities');
    if (!abilities) return;
    const entries: [InputAction, string, string, boolean, boolean][] = [
      [InputAction.Heal, 'heal', 'Cartes · soin', true, session.focus.resonance >= cardData.cost],
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
        'Écho mémoriel',
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
    const panel = `<section class="panel settings-panel"><div class="panel-heading"><div><p class="eyebrow">À VOTRE RYTHME</p><h2>Réglages</h2></div><button id="back" class="text-button">Terminé ↗</button></div><div class="tabs" role="tablist" aria-label="Catégories de réglages">${tabs.map(([id, name]) => `<button role="tab" id="tab-${id}" aria-selected="${id === tab}" aria-controls="panel-${id}" class="tab ${id === tab ? 'active' : ''}">${name}</button>`).join('')}</div>${tabs.map(([id]) => `<div class="tab-panel" role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" ${id === tab ? '' : 'hidden'}>${panels[id]}</div>`).join('')}<div class="settings-footer"><button id="reset-settings" class="text-button">Rétablir les valeurs par défaut</button></div></section>`;
    // On the title screen the settings are one of its pages; in a journey, a panel over it.
    if (this.front && this.root.querySelector('.title-shell')) this.shell('settings', panel);
    else this.root.innerHTML = `<div class="modal-scrim"></div>${panel}`;
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
      this.back();
      return;
    }
    if (menu.previous || menu.next) {
      // The bumpers turn the page's tabs; on the title's home, its sections.
      const tabs = [
        ...this.root.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
      ];
      const sectionsBar = [
        ...this.root.querySelectorAll<HTMLButtonElement>('.title-nav [data-section]'),
      ];
      const list = tabs.length ? tabs : sectionsBar;
      const index = list.findIndex(
        (t) => t.getAttribute('aria-selected') === 'true' || t.hasAttribute('aria-current'),
      );
      const next = list[(index + (menu.next ? 1 : -1) + list.length) % list.length];
      next?.click();
      if (tabs.length) this.root.querySelector<HTMLElement>(`#${next?.id}`)?.focus();
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
  /** Page of the journal shown when it next opens. */
  private journalTab: 'map' | 'bestiary' | 'memories' = 'map';
  /**
   * The journal: the map of the act Eidra is in, room by room; the foes met and
   * what is told of them; the fragments recovered, in their own words.
   */
  map(session: GameSession): void {
    const flags = session.narrative.flags;
    const room = session.room;
    const act = actOf(room);
    const svg = roomMap(act, {
      discovered: session.discovered,
      room: room.id,
      x: session.actor.x,
      y: session.actor.y,
      checkpoint: session.checkpoint,
      collected: session.inventory.collectibles,
      defeated: (id) => session.defeated(id),
    });
    const visited = roomsOf(act).filter((r) => session.discovered.has(r.id)).length;
    const total = roomsOf(act).filter((r) => !r.secret).length;
    const sealedStages = stages.filter(
      (stage) =>
        actOf(chunks.find((c) => c.id === stage.id)!) === act && !flags.has(stageFlag(stage.id)),
    ).length;
    const mapPage = `<div class="room-map-frame">${svg}</div><div class="map-key"><span>◇ Ancrage</span><span>✦ Pouvoir</span><span>❖ Fragment</span><span>◆ Reliquaire</span><span class="danger">☗ Gardien</span><span class="mint">● Eidra</span></div><p class="muted">${escape(sentence(room.name))} · ${visited} salle${visited > 1 ? 's' : ''} explorée${visited > 1 ? 's' : ''} sur ${total}${sealedStages ? ` · ⊘ ${sealedStages} passage${sealedStages > 1 ? 's' : ''} scellé${sealedStages > 1 ? 's' : ''}` : ''}</p><p class="muted">◇ ${escape(session.quests.objective(flags))} · ◆ ${session.inventory.shards} éclats</p>`;
    const foes = bestiary(session.bestiary);
    const known = foes.filter((f) => f.defeated > 0).length;
    const bestiaryPage = `<p class="muted">${known} sur ${foes.length} rencontrés et vaincus.</p><ul class="bestiary">${foes
      .map((foe) =>
        foe.defeated > 0
          ? `<li class="known ${foe.boss ? 'boss' : ''}"><strong>${escape(foe.name)}</strong><span class="count">${foe.boss ? 'Vaincu' : `Vaincus : ${foe.defeated}`}</span><p>${escape(foe.lore)}</p></li>`
          : `<li class="unknown"><strong>???</strong><span class="count">Jamais vaincu</span><p>Une ombre dont la mémoire ne garde rien.</p></li>`,
      )
      .join('')}</ul>`;
    const fragments = memories(session.narrative.memories);
    const memoriesPage = `<p class="muted">${fragments.filter((m) => m.found).length} fragments sur ${fragments.length}.</p><ol class="fragments-list">${fragments
      .map((m) =>
        m.found
          ? `<li class="found"><b>${m.number}</b><div><strong>${escape(m.speaker)}</strong>${m.lines.map((line) => `<p>${escape(line)}</p>`).join('')}</div></li>`
          : `<li><b>${m.number}</b><div><strong>FRAGMENT INCONNU</strong><p>Quelque part, une mémoire attend.</p></div></li>`,
      )
      .join('')}</ol>`;
    const tabs = [
      ['map', 'Carte'],
      ['bestiary', 'Bestiaire'],
      ['memories', 'Souvenirs'],
    ] as const;
    const panels = { map: mapPage, bestiary: bestiaryPage, memories: memoriesPage };
    const tab = this.journalTab;
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel map-panel journal-panel"><div class="panel-heading"><div><p class="eyebrow">JOURNAL DE LA RÉMANENCE</p><h2>${escape(act.title)}</h2></div><button id="back" class="text-button">Reprendre le voyage →</button></div><div class="tabs" role="tablist" aria-label="Journal">${tabs.map(([id, name]) => `<button role="tab" id="tab-${id}" aria-selected="${id === tab}" aria-controls="panel-${id}" class="tab ${id === tab ? 'active' : ''}">${name}</button>`).join('')}</div>${tabs.map(([id]) => `<div class="tab-panel" role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" ${id === tab ? '' : 'hidden'}>${panels[id]}</div>`).join('')}</section>`;
    const show = (id: (typeof tabs)[number][0]): void => {
      for (const [other] of tabs) {
        const selected = other === id;
        this.root.querySelector(`#tab-${other}`)?.setAttribute('aria-selected', String(selected));
        this.root.querySelector(`#tab-${other}`)?.classList.toggle('active', selected);
        this.root.querySelector<HTMLElement>(`#panel-${other}`)!.hidden = !selected;
      }
      this.journalTab = id;
    };
    for (const [id] of tabs) this.bind(`tab-${id}`, () => show(id));
    this.bind('back', this.actions.resume);
    this.focus();
  }
  ending(session: GameSession): void {
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="panel compact"><p class="eyebrow">FIN DE L’ACTE II</p><h2>Un ordre peut<br>être oublié.</h2><p>Ilyra a ouvert les yeux.<br>Au-delà du jardin, Nhalis se souvient.</p><div class="end-stats"><span>${session.narrative.memories.size}/${fundamentalMemories.length}<br><small>SOUVENIRS</small></span><span>${Math.floor(session.playtime / 60)} min<br><small>DE VOYAGE</small></span><span>◆ ${session.inventory.shards}<br><small>ÉCLATS</small></span></div><p class="muted small">Vous avez traversé les deux actes de cette version : ${landmarks.filter((l) => l.kind === 'memory').length} des ${fundamentalMemories.length} fragments s’y trouvent. La suite de Nhalis est en développement.</p><button id="explore" class="solid-button">Revenir explorer →</button><button id="menu" class="text-button">Menu principal</button></section>`;
    this.bind('explore', this.actions.resume);
    this.bind('menu', this.actions.menu);
    this.focus();
  }
  loading(): void {
    window.clearTimeout(this.slideTimer);
    this.root.innerHTML = `<div class="modal-scrim"></div><section class="loading-screen"><div class="loading-sigil">${mark}</div><p class="eyebrow">NHALIS SE SOUVIENT</p><p class="tip"><span>CONSEIL</span>${escape(tip())}</p></section>`;
  }
  /**
   * Stacked, self-dismissing notifications at the top of the screen. A notification
   * on a topic replaces the previous one on that topic (a gate sealed, then opened),
   * and the same words are never stacked twice.
   */
  notice(text: string, topic?: string): void {
    const box = this.overlay('toasts', 'toasts');
    for (const old of [...box.children] as HTMLElement[])
      if ((topic && old.dataset.topic === topic) || old.textContent === text) this.dropToast(old);
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    if (topic) toast.dataset.topic = topic;
    box.prepend(toast);
    while (box.children.length > MAX_TOASTS) box.lastElementChild?.remove();
    this.trimToasts();
    requestAnimationFrame(() => toast.classList.add('show'));
    const timer = window.setTimeout(() => {
      this.toastTimers.delete(timer);
      this.dropToast(toast);
    }, TOAST_LIFE);
    this.toastTimers.add(timer);
  }
  private dropToast(toast: HTMLElement): void {
    if (toast.dataset.leaving) return;
    toast.dataset.leaving = 'true';
    toast.classList.remove('show');
    const removal = window.setTimeout(() => {
      toast.remove();
      this.toastTimers.delete(removal);
    }, 400);
    this.toastTimers.add(removal);
  }
  dispose(): void {
    this.cancelCapture();
    this.stopTyping();
    this.keyboard.abort();
    window.clearTimeout(this.slideTimer);
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

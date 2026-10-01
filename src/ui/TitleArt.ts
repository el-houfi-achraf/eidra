import type { Mood } from '../../game-data/zones/moods';
/**
 * Line icons and small painted thumbnails of the title screen, as inline SVG so
 * they follow the text colour and cost no request. All original drawings.
 */
const svg = (body: string, view = '0 0 24 24'): string =>
  `<svg viewBox="${view}" aria-hidden="true" focusable="false">${body}</svg>`;
export const icons = {
  /** The emblem of the game: a diamond within a diamond, a thread through it. */
  emblem: svg(
    '<path d="M24 3 44 32 24 61 4 32Z M24 13 35 32 24 51 13 32Z M24 3V20 M24 44V61"/>',
    '0 0 48 64',
  ),
  diamond: svg('<path d="M12 3 20 12 12 21 4 12Z M12 8 16 12 12 16 8 12Z"/>'),
  folder: svg(
    '<path d="M3 7.5V18a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-8l-2-2.5H4a1 1 0 0 0-1 1Z"/>',
  ),
  gear: svg(
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5"/><circle cx="12" cy="12" r="6.6"/>',
  ),
  bell: svg(
    '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 1.8H4.4Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  ),
  arrow: svg('<path d="M4 12h15M14 6.5 19.5 12 14 17.5"/>'),
  back: svg('<path d="M20 12H5M10 6.5 4.5 12 10 17.5"/>'),
  play: svg('<path class="fill" d="M8.5 6.2v11.6L18 12Z"/>'),
  pause: svg('<path class="fill" d="M7.5 6h3v12h-3ZM13.5 6h3v12h-3Z"/>'),
  note: svg(
    '<path d="M9 18V6.5l10-2.2V16"/><circle cx="6.8" cy="18" r="2.3"/><circle cx="16.8" cy="16" r="2.3"/>',
  ),
  lock: svg(
    '<rect x="5.5" y="10.5" width="13" height="9.5" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  ),
  user: svg('<circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
  /** Four-pointed star that sits on the A of the title. */
  sparkle: svg(
    '<path class="fill" d="M32 0C33.6 22 42 30.4 64 32 42 33.6 33.6 42 32 64 30.4 42 22 33.6 0 32 22 30.4 30.4 22 32 0Z"/>',
    '0 0 64 64',
  ),
  /** Eidra's mask, for the profile chip. */
  mask: svg(
    '<path class="fill hood" d="M32 4C18 4 9 16 9 31c0 13 6 24 9 29h28c3-5 9-16 9-29C55 16 46 4 32 4Z"/><path class="fill face" d="M32 14c-9 0-15 8-15 18 0 9 6 17 15 19 9-2 15-10 15-19 0-10-6-18-15-18Z"/><path class="fill eye" d="M23 30c2-2 5-2 7 0-2 2-5 2-7 0Zm11 0c2-2 5-2 7 0-2 2-5 2-7 0Z"/><path class="fill crown" d="m22 9 4 5 6-7 6 7 4-5-2 8H24Z"/>',
    '0 0 64 64',
  ),
} as const;
export type IconId = keyof typeof icons;
/**
 * A tiny painted vista in a sector's colours: sky, a glow on the horizon,
 * arches and columns in three depths, still water and a figure on a rock.
 */
export function thumbnail(mood: Mood, id: string, motif: 'chapter' | 'score' | 'news'): string {
  const g = `thumb-${id}`;
  const arches = (y: number, color: string, scale: number, offset: number): string =>
    [0, 1, 2, 3]
      .map((i) => {
        const x = offset + i * 52 * scale;
        const w = 30 * scale,
          h = 46 * scale;
        return `<path fill="${color}" d="M${x} 90V${y + h * 0.4}a${w / 2} ${w / 2} 0 0 1 ${w} 0V90h${6 * scale}V${y}h-${w + 12 * scale}V90Z"/>`;
      })
      .join('');
  const subject =
    motif === 'chapter'
      ? `<ellipse cx="84" cy="72" rx="16" ry="4" fill="${mood.near}"/><circle cx="84" cy="38" r="15" fill="none" stroke="${mood.light}" stroke-width="1.6" opacity=".9"/><path fill="${mood.near}" d="M81 71l1.5-9h3l1.5 9Z"/><circle cx="84" cy="60" r="2.4" fill="${mood.near}"/>`
      : motif === 'score'
        ? `<g fill="none" stroke="${mood.light}" stroke-width="1.6" opacity=".9"><path d="M74 58V34l20-5v24"/><circle cx="70.5" cy="58" r="4" fill="${mood.light}"/><circle cx="90.5" cy="53" r="4" fill="${mood.light}"/></g>`
        : `<g fill="none" stroke="${mood.light}" stroke-width="1.6" opacity=".9"><path d="M76 54V42a8 8 0 0 1 16 0v12l3 3H73Z"/><path d="M81 61a3 3 0 0 0 6 0"/></g>`;
  return `<svg viewBox="0 0 168 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs><linearGradient id="${g}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mood.sky}"/><stop offset=".62" stop-color="${mood.horizon}"/><stop offset="1" stop-color="${mood.fog}"/></linearGradient><radialGradient id="${g}-sun" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="${mood.light}" stop-opacity=".9"/><stop offset="1" stop-color="${mood.light}" stop-opacity="0"/></radialGradient></defs><rect width="168" height="90" fill="url(#${g}-sky)"/><circle cx="84" cy="44" r="40" fill="url(#${g}-sun)"/>${arches(20, mood.far, 0.8, -6)}${arches(12, mood.mid, 1.05, -30)}<rect y="70" width="168" height="20" fill="${mood.ground}"/><rect y="70" width="168" height="1.2" fill="${mood.lip}" opacity=".7"/>${subject}<path fill="${mood.near}" d="M0 0h22c-8 14-10 40-6 90H0Z M168 0h-20c7 18 8 50 4 90h16Z"/></svg>`;
}

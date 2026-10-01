import { describe, expect, it } from 'vitest';
import { route } from '../../game-data/zones/laboratory';
import { enemyKinds } from '../../game-data/enemies/roster';
import { bossRoster } from '../../game-data/bosses/roster';
import { actOf, bestiary, markOf, memories, roomMap, roomsOf } from '../../src/ui/Journal';
import { roomById } from '../../src/world/Rooms';
import { sentence } from '../../src/core/text';

const state = (discovered: string[], room = discovered[0]!, x = 10, y = 1) => ({
  discovered: new Set(discovered),
  room,
  x,
  y,
  checkpoint: 'awakening',
  collected: new Set<string>(),
  defeated: () => false,
});

describe('journal map', () => {
  it('gathers the rooms of an act: its sectors and the chambers off them', () => {
    const actOne = route.acts[0];
    expect(actOf(roomById('archives')!)).toBe(actOne);
    expect(actOf(roomById('belfry')!)).toBe(actOne);
    expect(actOf(roomById('cinder-gate')!)).toBe(route.acts[1]);
    expect(roomsOf(actOne).length).toBeGreaterThanOrEqual(25);
  });
  it('shows visited rooms, glimpses those a doorway leads to, and hides secrets', () => {
    const seen = new Set(['awakening', 'watchers', 'mira-well', 'archives']);
    expect(markOf(roomById('archives')!, seen)).toBe('visited');
    // The elans chamber opens off the archives: glimpsed before it is entered.
    expect(markOf(roomById('elans')!, seen)).toBe('glimpsed');
    // The sealed study, though next door, stays secret until found.
    expect(markOf(roomById('sealed-study')!, seen)).toBe('hidden');
    expect(markOf(roomById('belfry')!, seen)).toBe('hidden');
    // Along the route, the next sector shows as unexplored.
    expect(markOf(roomById('palimpsest')!, seen)).toBe('glimpsed');
  });
  it('draws the act in metres, rooms, doorways, anchors and Eidra herself', () => {
    const svg = roomMap(
      route.acts[0],
      state(['awakening', 'watchers', 'mira-well', 'archives'], 'archives', 60, -28),
    );
    expect(svg).toContain('data-room="archives"');
    expect(svg).toMatch(/class="room visited chamber current/);
    expect(svg).toMatch(/class="room glimpsed chamber[^"]*" data-room="elans"/);
    expect(svg).not.toContain('data-room="sealed-study"');
    expect(svg).not.toContain('data-room="belfry"');
    // The well's mouth in the gallery's floor, as a doorway of light.
    expect(svg).toContain('<line class="door" x1="78" x2="80" y1="2" y2="2"/>');
    // The archives' anchor, and Eidra where she stands (y up becomes y down).
    expect(svg).toContain('Ancrage des archives');
    expect(svg).toContain('<circle class="you" cx="60" cy="28"');
    expect(svg).toContain(sentence('GALERIE DES VEILLEURS').toUpperCase());
  });
});

describe('journal pages', () => {
  it('lists every foe of the journey, named once one of them has fallen', () => {
    const entries = bestiary(
      new Map([
        ['mite', 3],
        ['keeper', 1],
      ]),
    );
    expect(entries).toHaveLength(enemyKinds.length + bossRoster.length);
    const mite = entries.find((e) => e.id === 'mite')!;
    expect(mite.defeated).toBe(3);
    expect(mite.lore.length).toBeGreaterThan(10);
    expect(entries.find((e) => e.id === 'keeper')).toMatchObject({ boss: true, defeated: 1 });
    expect(entries.filter((e) => e.defeated > 0)).toHaveLength(2);
  });
  it('keeps the words of the fragments recovered, and only those', () => {
    const list = memories(new Set(['kael', 'aren']));
    expect(list).toHaveLength(7);
    expect(list[0]).toMatchObject({ id: 'kael', number: '01', found: true });
    expect(list[0]!.lines.length).toBeGreaterThan(0);
    expect(list.find((m) => m.id === 'noa')).toMatchObject({ found: false, lines: [] });
    expect(list.find((m) => m.id === 'aren')!.speaker).toBe('FRAGMENT · AREN');
  });
  it('writes room names as sentences, keeping proper names', () => {
    expect(sentence('LE PUITS DE MIRA')).toBe('Le puits de Mira');
    expect(sentence('LA LOGE DE NOA')).toBe('La loge de Noa');
    expect(sentence('GALERIE DES VEILLEURS')).toBe('Galerie des veilleurs');
  });
});

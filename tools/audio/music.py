"""The EIDRA soundtrack: original compositions written as data. Every piece shares
Eidra's motif (D minor: a rising fourth, a step up, a fall back through the
scale) so the journey keeps one voice, as chamber-orchestral scores of the
genre do. TODO_ART: synthesized placeholders until a recorded score exists.
"""
from __future__ import annotations

from score import Song, Track, at, pattern, repeat, seq

EIGHTHS = [(i * 0.5, 0.5, k) for i, k in enumerate([0, 1, 2, 1, 3, 1, 2, 1])]


def bars(chords: list[str], beats_per: float = 4, vel: float = 0.5, start: float = 0) -> list:
    return [at(start + i * beats_per, beats_per, c, vel) for i, c in enumerate(chords)]


def title() -> Song:
    """« Éclats de silence » — the main menu: piano, cello, strings, then voices."""
    pads = ['d3+a3+f4', 'd3+bb3+f4', 'c3+a3+f4', 'c3+g3+e4',
            'd3+a3+f4', 'd3+bb3+g4', 'd3+bb3+f4', 'c#3+a3+e4',
            'd3+a3+f4', 'd3+bb3+f4', 'c3+a3+f4', 'c3+g3+e4',
            'd3+bb3+g4', 'd3+bb3+f4', 'd3+a3+e4', 'c#3+a3+e4']
    arps = ['d4+a4+d5+f5', 'bb3+f4+bb4+d5', 'f4+c5+f5+a5', 'c4+g4+c5+e5',
            'd4+a4+d5+f5', 'g3+d4+g4+bb4', 'bb3+f4+bb4+d5', 'a3+e4+a4+c#5',
            'd4+a4+d5+f5', 'bb3+f4+bb4+d5', 'f4+c5+f5+a5', 'c4+g4+c5+e5',
            'g3+d4+g4+bb4', 'bb3+f4+bb4+d5', 'a3+d4+e4+a4', 'a3+e4+a4+c#5']
    roots = ['d2', 'bb1', 'f2', 'c2', 'd2', 'g1', 'bb1', 'a1'] * 2
    left = [e for i, r in enumerate(roots) for e in seq(f'{r}+{r[:-1]}{int(r[-1]) + 1}:2 r:2', i * 4, 0.55)]
    motif = seq('a3:1 d4:1.5 e4:.5 f4:1 | g4:2 f4:1 e4:1 | f4:1.5 d4:.5 bb3:1 c4:1 | c#4:2 e4:1 a3:1',
                16, 0.75)
    answer = seq('d5:3 c5:.5 bb4:.5 | bb4:2 a4:1 f4:1 | a4:1.5 g4:.5 f4:1 a4:1 | g4:3 e4:1', 32, 0.65)
    close = seq('g4:1.5 a4:.5 bb4:1 d5:1 | f5:2 d5:1 bb4:1 | a4:3 g4:.5 f4:.5 | e4:2 c#4:1 e4:1', 48, 0.7)
    sparkle = seq('r:2 a5:1 d6:1 | r:4 | r:2 c6:1 f6:1 | e6:4', 0, 0.35)
    sparkle += seq('r:2 f6:1 a6:1 | r:4 | r:2 a5:1 c6:1 | g5:4', 32, 0.25)
    return Song('title', 64, 64, [
        Track('piano', pattern(arps, 4, EIGHTHS, vel=0.38), pan=0.1, gain=0.9, send=0.4),
        Track('piano', left, pan=-0.15, gain=0.8, send=0.35),
        Track('strings', bars(pads[:8], vel=0.35) + bars(pads[8:], vel=0.55, start=32),
              pan=0, gain=0.55, send=0.5, spread=0.3),
        Track('cello', motif + close, pan=-0.2, gain=0.85, send=0.4),
        Track('violin', answer, pan=0.25, gain=0.6, send=0.45),
        Track('choir', bars([p.replace('3', '4').replace('4+', '4+') for p in pads[8:]], vel=0.4, start=32),
              pan=0, gain=0.4, send=0.6, spread=0.4),
        Track('celesta', sparkle, pan=0.35, gain=0.5, send=0.6),
    ], room=(3.4, 5000, 1300), wet=0.5)


WALTZ = [(0, 1, 0), (1, 0.5, 1), (1.5, 0.5, 2), (2, 0.5, 3), (2.5, 0.5, 2)]
SIXTEENTHS = [(i * 0.25, 0.25, k) for i, k in enumerate([0, 1, 2, 3, 2, 1, 2, 1] * 2)]
OSTINATO = [(i * 0.5, 0.3, k) for i, k in enumerate([0, 2, 1, 2, 0, 2, 1, 2])]


def lumerite() -> Song:
    """« Lumérite » — the cold vaults: a drone, a piano that barely dares, a celesta memory."""
    pads = ['a2+e3+f3', 'a2+e3+f3', 'bb2+f3+a3+d4', 'bb2+f3+a3+d4', 'a2+e3+f3+c4', 'a2+e3+f3+c4',
            'd3+f3+bb3+a4', 'd3+f3+bb3+a4', 'bb2+f3+a3+e4', 'bb2+f3+a3+e4', 'c3+g3+a3+d4',
            'c3+g3+a3+d4', 'a2+d3+e3+a3', 'a2+c#3+e3+a3']
    piano = seq('r:1 a4:3 | f5:2 e5:2 | r:1 d5:3 | a4:4 | r:2 c5:2 | e5:2 d5:2 | r:1 f5:3 | e5:4 '
                '| r:2 a5:2 | g5:1 f5:1 e5:2 | r:1 d5:3 | e5:4 | r:2 d5:2 | c#5:4', 0, 0.38)
    memory = seq('a5:1 d6:1.5 e6:.5 f6:1 | g6:2 f6:1 e6:1', 32, 0.3)
    return Song('lumerite', 58, 56, [
        Track('drone', [at(0, 48, 'd2', 0.6), at(48, 8, 'a1', 0.6)], gain=0.35, send=0.3),
        Track('strings', bars(pads, vel=0.32), gain=0.5, send=0.6, spread=0.35,
              options={'bright': 1500, 'attack': 1.2, 'release': 1.6}),
        Track('piano', piano, pan=0.15, gain=0.95, send=0.6),
        Track('celesta', memory, pan=-0.3, gain=0.55, send=0.7),
        Track('choir', bars([p.replace('2', '4').replace('3', '4') for p in pads[8:]], vel=0.3, start=32),
              gain=0.3, send=0.7, spread=0.4),
    ], room=(4.6, 4200, 1000), wet=0.6, loudness=0.09)


def mira() -> Song:
    """« Berceuse de Mira » — the gallery: a music box lullaby over a harp."""
    chords = ['f2+c3+f3+a3', 'f2+c3+f3+a3', 'd2+a2+d3+f3', 'd2+a2+d3+f3', 'bb1+f2+bb2+d3',
              'bb1+f2+bb2+d3', 'c2+g2+c3+e3', 'c2+g2+c3+e3', 'f2+c3+f3+a3', 'a1+e2+a2+c3',
              'bb1+f2+bb2+d3', 'a1+f2+a2+c3', 'g1+d2+g2+bb2', 'c2+g2+c3+e3', 'f2+c3+f3+a3',
              'f2+c3+f3+a3', 'd2+a2+d3+f3', 'd2+a2+d3+f3', 'bb1+f2+bb2+d3', 'bb1+f2+bb2+d3',
              'g1+d2+g2+bb2', 'c2+g2+c3+e3', 'f2+c3+f3+a3', 'c2+g2+c3+e3']
    tune = seq('c6:1 a5:1 f5:1 | g5:1.5 a5:.5 bb5:1 | a5:2 f5:1 | d5:3 | bb5:1 a5:1 g5:1 '
               '| f5:1.5 g5:.5 a5:1 | g5:3 | e5:2 c5:1 '
               '| f5:1 a5:1 c6:1 | e6:2 c6:1 | d6:1 c6:1 bb5:1 | a5:3 | bb5:1.5 a5:.5 g5:1 '
               '| e5:2 g5:1 | f5:3 | r:3 '
               '| a5:1 d6:1.5 e6:.5 | f6:2 e6:1 | d6:3 | r:3 | g5:1 bb5:1.5 a5:.5 | g5:3 '
               '| f5:2 g5:1 | e5:3', 0, 0.5)
    cello = seq('f3:3 | e3:3 | d3:3 | c3:3 | bb2:3 | c3:3 | f3:3 | r:3', 24, 0.45)
    pad = [c.split('+', 1)[1] for c in chords]
    return Song('mira', 76, 72, [
        Track('harp', pattern(chords, 3, WALTZ, vel=0.42, octave=1), pan=-0.2, gain=0.8, send=0.45),
        Track('music_box', tune, pan=0.25, gain=0.7, send=0.55),
        Track('strings', bars(pad, 3, vel=0.25), gain=0.45, send=0.55, spread=0.3,
              options={'bright': 1800, 'attack': 0.8, 'release': 1.2}),
        Track('cello', cello, pan=-0.3, gain=0.6, send=0.45),
        Track('choir', bars([c.replace('2', '4').replace('3', '4') for c in pad[16:]], 3, vel=0.3, start=48),
              gain=0.3, send=0.7, spread=0.4),
    ], room=(3.6, 5200, 1500), wet=0.5, loudness=0.1)


def machinery() -> Song:
    """« Contrepoids » — the machine halls: a ticking ostinato and a weary viola."""
    roots = ['d2+a2+d3+f3'] * 8 + ['bb1+f2+bb2+d3'] * 4 + ['c2+g2+c3+e3'] * 4 + ['a1+e2+a2+c#3'] * 4
    figure = [(0, 0.3, 0), (0.5, 0.3, 2), (1, 0.3, 1), (1.5, 0.3, 2), (2, 0.3, 3), (2.5, 0.3, 2),
              (3, 0.3, 1), (3.5, 0.3, 2)]
    viola = seq('a3:4 | bb3:4 | a3:2 g3:2 | f3:4 | f3:4 | d3:4 | f3:2 g3:2 | f3:4 '
                '| e3:4 | g3:2 e3:2 | d3:4 | e3:4 | e3:4 | c#3:4 | d3:2 e3:2 | e3:4', 16, 0.55)
    ticks = [at(b, 0.1, 'c7', 0.4 if b % 4 == 0 else 0.22) for b in range(80)]
    tolls = [at(b, 4, n, 0.4) for b, n in ((0, 'd2+d3'), (16, 'd2+d3'), (32, 'bb1+bb2'), (48, 'c2+c3'),
                                           (64, 'a1+a2'))]
    drums = [at(b, 1, 'd2', 0.45 if b % 4 == 0 else 0.3) for b in range(48, 80, 2)]
    drones = [at(0, 32, 'd2', 0.5), at(32, 16, 'bb1', 0.5), at(48, 16, 'c2', 0.5), at(64, 16, 'a1', 0.5)]
    return Song('machinery', 84, 80, [
        Track('spiccato', pattern(roots, 4, figure, vel=0.5), pan=-0.1, gain=0.8, send=0.3),
        Track('tick', ticks, pan=0.3, gain=0.7, send=0.25, humanize=0.002),
        Track('cello', viola, pan=0.2, gain=0.75, send=0.45),
        Track('piano', tolls, gain=0.7, send=0.55),
        Track('frame_drum', drums, gain=0.4, send=0.3),
        Track('drone', drones, gain=0.3, send=0.3),
        Track('choir', [at(64, 16, 'a3+e4+c#5', 0.3)], gain=0.35, send=0.6, options={'vowel': 'ah'}),
    ], room=(2.8, 4500, 1200), wet=0.4, loudness=0.11)


def ashes() -> Song:
    """« Cendres » — the rifts of Act II: a harp ostinato, a heartbeat drum, a cello in Phrygian."""
    harmony = ['c3+g3+c4+eb4', 'c3+g3+c4+eb4', 'db3+ab3+db4+f4', 'db3+ab3+db4+f4', 'c3+g3+c4+eb4',
               'ab2+eb3+ab3+c4', 'db3+ab3+db4+f4', 'g2+d3+g3+b3', 'c3+g3+c4+eb4', 'c3+g3+c4+eb4',
               'db3+ab3+db4+f4', 'db3+ab3+db4+f4', 'ab2+eb3+ab3+c4', 'f2+c3+f3+ab3', 'db3+ab3+db4+f4',
               'g2+d3+g3+b3']
    heartbeat = [e for b in range(16) for e in (at(b * 4, 1, 'c2', 0.55), at(b * 4 + 0.5, 1, 'c2', 0.35),
                                                at(b * 4 + 2, 1, 'c2', 0.4))]
    cello = seq('g3:2 ab3:1 g3:1 | f3:2 eb3:2 | f3:1.5 eb3:.5 db3:2 | d3:2 b2:2 '
                '| c3:1 eb3:1 g3:1.5 ab3:.5 | g3:4 | ab3:2 f3:1 db3:1 | c3:2 db3:2', 16, 0.65)
    voices = seq('c5:2 eb5:2 | f5:3 eb5:1 | db5:2 c5:1 bb4:1 | b4:4', 48, 0.45)
    low = [h.rsplit('+', 2)[0] for h in harmony]
    return Song('ashes', 68, 64, [
        Track('harp', pattern(harmony, 4, EIGHTHS, vel=0.38), pan=0.2, gain=0.8, send=0.45),
        Track('frame_drum', heartbeat, gain=0.5, send=0.3),
        Track('strings', bars(low, vel=0.35), gain=0.5, send=0.5, spread=0.25,
              options={'bright': 1200, 'attack': 0.9, 'release': 1.4}),
        Track('cello', cello, pan=-0.25, gain=0.85, send=0.45),
        Track('choir', voices, pan=0.1, gain=0.5, send=0.7, options={'vowel': 'ah'}),
        Track('horn', bars(['ab2+eb3', 'f2+c3', 'db3+ab3', 'g2+d3'], vel=0.35, start=48), gain=0.5, send=0.5),
    ], room=(3.8, 4000, 1100), wet=0.5, loudness=0.1)


def garden() -> Song:
    """« Le Jardin du déni » — a waltz that will not end: celesta, voices, plucked strings."""
    harmony = ['e2+e3+g3+b3', 'e2+e3+g3+b3', 'c2+e3+g#3+c4', 'c2+e3+g3+c4', 'a1+a2+c3+e3', 'a1+a2+c3+e3',
               'b1+a2+d#3+f#3', 'b1+a2+d#3+f#3', 'e2+e3+g3+b3', 'e2+e3+g3+b3', 'g1+g2+b2+d3', 'g1+g2+b2+d3',
               'c2+e3+g3+c4', 'c2+e3+g3+c4', 'f#1+f#2+a2+c3', 'b1+a2+d#3+f#3', 'e2+e3+g3+b3', 'd2+e3+g3+b3',
               'c#2+e3+g3+b3', 'c2+e3+g3+c4', 'a1+a2+c3+e3', 'a1+a2+c3+e3', 'b1+a2+d#3+f#3',
               'b1+a2+d#3+f#3', 'e2+e3+g3+b3', 'c2+e3+g3+c4', 'b1+a2+d#3+f#3', 'b1+a2+d#3+f#3']
    waltz = [(0, 1, 0), (1, 0.5, 2), (2, 0.5, 3)]
    tune = seq('b5:2 c6:1 | b5:1 a#5:1 b5:1 | g#5:3 | g5:3 | a5:2 c6:1 | e6:3 | d#6:2 c6:1 | b5:3 '
               '| g5:1 f#5:1 e5:1 | b5:3 | d6:2 b5:1 | g5:3 | e6:1 d6:1 c6:1 | g5:3 | a5:2 c6:1 | b5:3', 0, 0.45)
    echo = seq('b5:2 c6:1 | b5:1 a5:1 g5:1 | e5:3 | g5:2 e5:1 | a5:2 c6:1 | e6:3 | d#6:2 f#6:1 | b5:3 '
               '| e6:2 b5:1 | c6:2 e6:1 | d#6:1 c6:1 a5:1 | b5:3', 48, 0.35)
    upper = [h.split('+', 1)[1].replace('3', '5').replace('2', '5') for h in harmony]
    return Song('garden', 96, 84, [
        Track('pizzicato', pattern(harmony, 3, waltz, vel=0.5), pan=-0.15, gain=0.9, send=0.4),
        Track('celesta', tune, pan=0.25, gain=0.65, send=0.6),
        Track('music_box', echo, pan=-0.3, gain=0.45, send=0.7),
        Track('strings', bars(upper, 3, vel=0.18), gain=0.35, send=0.6, spread=0.4,
              options={'bright': 3200, 'attack': 1.0, 'release': 1.5}),
        Track('choir', bars([h.split('+', 1)[1].replace('3', '4') for h in harmony[16:]], 3, vel=0.32, start=48),
              gain=0.4, send=0.7, spread=0.4),
        Track('bell', [at(0, 1, 'e4', 0.35), at(48, 1, 'e4', 0.35)], gain=0.6, send=0.7),
    ], room=(4.2, 5000, 1200), wet=0.55, loudness=0.095)


def keeper() -> Song:
    """« Le Dernier Ordre » — the Keeper's march: snare, timpani, horns and a stubborn motif."""
    harmony = ['g2+d3+g3+bb3', 'g2+d3+g3+bb3', 'eb2+bb2+eb3+g3', 'd2+a2+d3+f#3', 'g2+d3+g3+bb3',
               'c2+g2+c3+eb3', 'eb2+bb2+eb3+g3', 'd2+a2+d3+f#3', 'g2+d3+g3+bb3', 'f2+c3+f3+a3',
               'eb2+bb2+eb3+g3', 'd2+a2+d3+f#3', 'c2+g2+c3+eb3', 'bb1+d3+g3+bb3', 'a1+c3+eb3+g3',
               'd2+a2+d3+f#3', 'g2+d3+g3+bb3', 'eb2+bb2+eb3+g3', 'bb1+f2+bb2+d3', 'f2+c3+f3+a3',
               'c2+g2+c3+eb3', 'eb2+bb2+eb3+g3', 'd2+a2+d3+f#3', 'd2+a2+c3+f#3']
    snare = []
    for b in range(24):
        for k, v in ((0, 0.6), (1, 0.35), (1.5, 0.3), (2, 0.55), (3, 0.35), (3.5, 0.3)):
            snare.append(at(b * 4 + k, 0.25, 'c4', v))
        if b % 4 == 3:
            snare += [at(b * 4 + 3 + i * 0.25, 0.25, 'c4', 0.3 + i * 0.08) for i in range(4)]
    timp = [at(b * 4 + k, 1, h.split('+')[0 if k == 0 else 1], 0.6 if k == 0 else 0.45)
            for b, h in enumerate(harmony) for k in (0, 2)]
    motif = ('g3:1.5 a3:.5 bb3:1 d4:1 | c4:1.5 bb3:.5 a3:2 | bb3:1.5 a3:.5 g3:1 bb3:1 | a3:3 d3:1 '
             '| g3:1.5 a3:.5 bb3:1 d4:1 | eb4:2 d4:1 c4:1 | bb3:1.5 c4:.5 d4:1 g3:1 | a3:3 r:1')
    violins = seq('d5:2 bb4:1 g4:1 | f4:1.5 g4:.5 a4:2 | g4:1 bb4:1 eb5:2 | d5:3 c5:.5 bb4:.5 '
                  '| c5:2 eb5:2 | d5:1 bb4:1 g4:2 | a4:1.5 c5:.5 eb5:2 | d5:4', 32, 0.6)
    upper = seq('g4:1.5 a4:.5 bb4:1 d5:1 | c5:1.5 bb4:.5 a4:2 | bb4:1.5 a4:.5 g4:1 bb4:1 | a4:3 d4:1 '
                '| g4:1.5 a4:.5 bb4:1 d5:1 | eb5:2 d5:1 c5:1 | bb4:1.5 c5:.5 d5:1 g4:1 | a4:3 r:1', 64, 0.65)
    return Song('keeper', 112, 96, [
        Track('snare', snare, pan=0.15, gain=0.6, send=0.25, humanize=0.003),
        Track('timpani', timp, gain=0.8, send=0.35),
        Track('drum', [at(b * 4, 1, 'g1', 0.6) for b in range(24)], gain=0.4, send=0.3),
        Track('horn', seq(motif, 0, 0.7) + upper, pan=-0.2, gain=0.85, send=0.4),
        Track('spiccato', pattern([h.split('+', 1)[1] for h in harmony], 4, OSTINATO, vel=0.42), pan=0.25,
              gain=0.6, send=0.3),
        Track('violin', violins, pan=0.3, gain=0.7, send=0.45),
        Track('choir', bars([h.split('+', 1)[1].replace('2', '4').replace('3', '4') for h in harmony[16:]],
                            vel=0.4, start=64), gain=0.4, send=0.6, options={'vowel': 'ah'}),
        Track('swell', [at(92, 4, 'c4', 0.6)], gain=0.6, send=0.5),
    ], room=(2.6, 5000, 1500), wet=0.35, loudness=0.13)


def guardian() -> Song:
    """« Celui qui n'a jamais désobéi » — organ, timpani, trembling strings and a chant."""
    harmony = ['c#3+g#3+c#4+e4', 'c#3+g#3+c#4+e4', 'a2+e3+a3+c#4', 'a2+e3+a3+c#4', 'f#2+c#3+f#3+a3',
               'f#2+c#3+f#3+a3', 'g#2+d#3+f#3+b#3', 'g#2+d#3+f#3+b#3', 'c#3+g#3+c#4+e4', 'b2+f#3+b3+d#4',
               'a2+e3+a3+c#4', 'g#2+d#3+f#3+b#3', 'c#3+g#3+c#4+e4', 'e2+b2+e3+g#3', 'f#2+c#3+f#3+a3',
               'g#2+d#3+f#3+b#3', 'a2+e3+a3+c#4', 'b2+f#3+b3+d#4', 'c#3+g#3+c#4+e4', 'c#3+g#3+c#4+e4',
               'f#2+c#3+f#3+a3', 'g#2+d#3+f#3+b#3', 'c#3+g#3+c#4+e4', 'c#3+g#3+c#4+e4', 'a2+e3+a3+c#4',
               'f#2+c#3+f#3+a3', 'g#2+d#3+f#3+b#3', 'g#2+d#3+f#3+b#3']
    chant = seq('c#5:2 e5:1 g#5:1 | f#5:3 d#5:1 | e5:2 c#5:2 | b#4:4 | c#5:1.5 d#5:.5 e5:1 g#5:1 '
                '| f#5:1.5 e5:.5 d#5:2 | e5:1.5 c#5:.5 a4:1 b4:1 | b#4:2 d#5:2 | e5:2 a5:2 '
                '| f#5:2 d#5:1 b4:1 | c#5:4 | g#4:2 e5:2 | a5:2 f#5:1 c#5:1 | b#4:2 f#5:2 | e5:4 | c#5:4',
                32, 0.55)
    timp = [at(b * 4 + k, 1, h.split('+')[0], v) for b, h in enumerate(harmony)
            for k, v in ((0, 0.65), (1.5, 0.4), (2.5, 0.5))]
    lows = [at(b * 4 + k, 1, 'c#2', 0.55) for b in range(16, 28) for k in (0, 2)]
    return Song('guardian', 124, 112, [
        Track('organ', bars(harmony, vel=0.5), gain=0.75, send=0.55, spread=0.3),
        Track('timpani', timp, gain=0.85, send=0.35),
        Track('strings', bars([h.split('+', 1)[1] for h in harmony], vel=0.4) +
              bars([h.split('+', 1)[1] for h in harmony[8:]], vel=0.5, start=32), gain=0.45,
              send=0.45, spread=0.3, options={'tremolo': 9, 'attack': 0.2, 'bright': 2800}),
        Track('choir', chant, gain=0.75, send=0.65, options={'vowel': 'ah', 'attack': 0.25}),
        Track('spiccato', pattern([h.rsplit('+', 1)[0] for h in harmony[16:]], 4, SIXTEENTHS, vel=0.4,
                                  start=64), pan=-0.25, gain=0.55, send=0.3),
        Track('drum', lows, gain=0.4, send=0.35),
        Track('swell', [at(28, 4, 'c4', 0.5), at(60, 4, 'c4', 0.5), at(108, 4, 'c4', 0.7)], gain=0.55),
        Track('gong', [at(0, 4, 'c#2', 0.5)], gain=0.6, send=0.6),
    ], room=(3.6, 4500, 1300), wet=0.45, loudness=0.13)


def warden() -> Song:
    """« Braises » — the Sentinelle: drums in fire, racing strings, horn stabs."""
    names = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A', 'Gm', 'Gm', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A',
             'Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Dm', 'Bb', 'Bb', 'C', 'C', 'A', 'A']
    voicing = {'Dm': 'd3+a3+d4+f4', 'Bb': 'bb2+f3+bb3+d4', 'C': 'c3+g3+c4+e4', 'A': 'a2+e3+a3+c#4',
               'Gm': 'g2+d3+g3+bb3', 'F': 'f2+c3+f3+a3'}
    harmony = [voicing[n] for n in names]
    drums = [at(b * 4 + k, 0.5, 'a1', v) for b in range(32) for k, v in ((0, 0.8), (1.5, 0.5), (2, 0.65), (3.5, 0.5))]
    shaker = [at(i * 0.25, 0.25, 'c6', 0.3 if i % 2 == 0 else 0.18) for i in range(128 * 4)]
    stabs = [at(b * 4 + k, 0.6, h.rsplit('+', 1)[0], 0.55) for b, h in enumerate(harmony) if b >= 8
             for k in (0, 2.5)]
    tune = seq('d5:1.5 c5:.5 bb4:1 a4:1 | g4:4 | a4:1.5 bb4:.5 c5:1 d5:1 | f5:4 | f5:1.5 d5:.5 bb4:2 '
               '| c5:1.5 d5:.5 e5:2 | c#5:2 e5:2 | a4:4 | d5:1.5 e5:.5 f5:1 a5:1 | g5:2 f5:1 d5:1 '
               '| e5:2 g5:2 | c#5:4 | d5:1.5 e5:.5 f5:1 a5:1 | bb5:2 a5:1 f5:1 | g5:2 d5:2 | e5:2 c#5:2',
               32, 0.65)
    swells = [at(b * 4 - 4, 4, 'c4', 0.5) for b in (8, 16, 24, 32)]
    return Song('warden', 152, 128, [
        Track('drum', drums, gain=0.45, send=0.3, humanize=0.003),
        Track('frame_drum', [at(b * 2, 1, 'd3', 0.4) for b in range(64)], gain=0.35, send=0.25),
        Track('shaker', shaker, pan=0.35, gain=0.35, send=0.15, humanize=0.002),
        Track('spiccato', pattern([h.split('+', 1)[1] for h in harmony], 4, SIXTEENTHS, vel=0.42), pan=-0.2,
              gain=0.6, send=0.3),
        Track('horn', stabs, gain=0.6, send=0.35),
        Track('violin', tune, pan=0.25, gain=0.75, send=0.4),
        Track('horn', seq('d4:1.5 e4:.5 f4:1 a4:1 | g4:2 f4:1 d4:1 | e4:2 g4:2 | c#4:4', 64, 0.55),
              pan=-0.25, gain=0.5, send=0.4),
        Track('choir', bars([h.replace('2', '4').replace('3', '4') for h in harmony[24:]], vel=0.4, start=96),
              gain=0.45, send=0.6, options={'vowel': 'ah'}),
        Track('swell', swells, gain=0.5, send=0.4),
    ], room=(2.4, 5500, 1600), wet=0.32, loudness=0.135)


def ilyra() -> Song:
    """« Celle qui refusait de voir » — a tragic waltz: harp, voices, then the whole ensemble."""
    names = ['Bm', 'Bm', 'G', 'G', 'Em', 'Em', 'F#7', 'F#7', 'Bm', 'Bm', 'D', 'D', 'G', 'A', 'F#7', 'F#7',
             'Bm', 'Bm/A', 'G', 'G', 'Em', 'A', 'D', 'F#7', 'Bm', 'G', 'Em', 'F#7', 'Bm', 'D', 'G', 'A',
             'Em', 'F#7', 'Bm', 'G', 'Em', 'C#o', 'F#7', 'F#7']
    voicing = {'Bm': 'b2+f#3+b3+d4', 'G': 'g2+d3+g3+b3', 'Em': 'e2+b2+e3+g3', 'F#7': 'f#2+c#3+e3+a#3',
               'D': 'd2+a2+d3+f#3', 'A': 'a2+e3+a3+c#4', 'Bm/A': 'a2+f#3+b3+d4', 'C#o': 'c#3+g3+b3+e4'}
    harmony = [voicing[n] for n in names]
    sparkle = seq('d6:1 c#6:1 b5:1 | f#5:3 | d6:1 b5:1 g5:1 | d6:3 | e6:1 b5:1 g5:1 | e5:3 '
                  '| f#5:1 a#5:1 c#6:1 | f#6:3', 0, 0.4)
    voices = seq('f#5:3 | e5:2 d5:1 | c#5:2 d5:1 | a4:3 | b4:2 d5:1 | e5:2 c#5:1 | a#4:3 | c#5:3 '
                 '| d5:2 f#5:1 | e5:3 | d5:1 b4:1 g4:1 | b4:3 | e5:2 g5:1 | f#5:2 e5:1 | d5:3 | c#5:3', 24, 0.55)
    violin = seq('f#5:1 b5:1.5 c#6:.5 | d6:2 b5:1 | e6:2 d6:1 | c#6:3 | b5:2 f#5:1 | a5:2 f#5:1 '
                 '| g5:2 b5:1 | a5:3 | g5:1 b5:1 e6:1 | f#6:2 e6:1 | d6:3 | b5:3 | g5:2 e5:1 | e5:2 g5:1 '
                 '| f#5:3 | a#5:3', 72, 0.62)
    timp = [at(b * 3, 1, h.split('+')[0], 0.5 if b < 24 else 0.65) for b, h in enumerate(harmony) if b % 2 == 0]
    upper = [h.split('+', 1)[1] for h in harmony]
    return Song('ilyra', 150, 120, [
        Track('harp', pattern(harmony, 3, WALTZ, vel=0.45), pan=-0.2, gain=0.85, send=0.45),
        Track('strings', bars(upper, 3, vel=0.35), gain=0.5, send=0.5, spread=0.3,
              options={'bright': 2400, 'attack': 0.4}),
        Track('strings', bars(upper[28:], 3, vel=0.45, start=84), gain=0.35, send=0.4,
              options={'tremolo': 10, 'attack': 0.1, 'bright': 3000}),
        Track('celesta', sparkle, pan=0.3, gain=0.55, send=0.6),
        Track('choir', voices, gain=0.7, send=0.65, options={'vowel': 'ah', 'attack': 0.3}),
        Track('violin', violin, pan=0.25, gain=0.75, send=0.45),
        Track('timpani', timp, gain=0.7, send=0.35),
        Track('swell', [at(117, 3, 'c4', 0.6)], gain=0.55),
    ], room=(3.2, 5200, 1400), wet=0.45, loudness=0.13)


# --- Stingers: one-shot cues, not looped ---------------------------------------------


def victory() -> Song:
    return Song('victory', 60, 5, [
        Track('strings', [at(0, 4, 'd3+a3+f#4+a4', 0.5)], gain=0.6, send=0.6, options={'attack': 1.2}),
        Track('choir', [at(0.5, 3.5, 'd4+a4+f#5', 0.5)], gain=0.55, send=0.7, options={'vowel': 'ah'}),
        Track('celesta', seq('d6:.5 f#6:.5 a6:.5 d7:2', 1, 0.4), gain=0.5, send=0.7),
        Track('bell', [at(0, 1, 'd5', 0.5)], gain=0.6, send=0.7),
        Track('gong', [at(0, 4, 'd2', 0.35)], gain=0.5, send=0.5),
    ], room=(4.0, 5000, 1300), wet=0.55, loudness=None, loop=False)


def ability() -> Song:
    run = [at(i * 0.125, 0.5, n, 0.35 + i * 0.03) for i, n in enumerate(
        ['d4', 'e4', 'f#4', 'a4', 'b4', 'd5', 'e5', 'f#5', 'a5', 'b5', 'd6', 'e6'])]
    return Song('ability', 90, 6, [
        Track('harp', run, gain=0.8, send=0.6),
        Track('choir', [at(1.5, 4, 'd4+a4+e5+f#5', 0.55)], gain=0.6, send=0.7, options={'vowel': 'ah', 'attack': 0.5}),
        Track('strings', [at(1.5, 4, 'd3+a3+d4', 0.45)], gain=0.5, send=0.6),
        Track('bell', [at(1.5, 1, 'a5', 0.45)], gain=0.55, send=0.7),
    ], room=(4.0, 5500, 1400), wet=0.55, loudness=None, loop=False)


def rest() -> Song:
    return Song('rest', 72, 4, [
        Track('harp', seq('d3:.5 a3:.5 d4:.5 f#4:.5 a4:2', 0, 0.45), gain=0.8, send=0.55),
        Track('strings', [at(0.5, 3, 'd3+a3+f#4', 0.35)], gain=0.5, send=0.6, options={'attack': 0.8}),
    ], room=(3.5, 5000, 1300), wet=0.5, loudness=None, loop=False)


def death() -> Song:
    return Song('death', 50, 4, [
        Track('choir', [at(0, 3, 'd3+eb3+a3', 0.45)], gain=0.55, send=0.6, options={'attack': 0.4}),
        Track('cello', [at(0, 3, 'd2', 0.6)], gain=0.7, send=0.5),
        Track('gong', [at(0, 4, 'd2', 0.5)], gain=0.6, send=0.5),
        Track('bell', [at(1, 1, 'eb4', 0.3)], gain=0.5, send=0.7),
    ], room=(4.5, 3500, 900), wet=0.6, loudness=None, loop=False)


def act() -> Song:
    return Song('act', 60, 6, [
        Track('gong', [at(0, 4, 'c2', 0.6)], gain=0.7, send=0.5),
        Track('strings', [at(0.5, 5, 'c2+g2+eb3+g3', 0.5)], gain=0.6, send=0.55, options={'attack': 1.5}),
        Track('horn', [at(1, 4, 'c3+g3', 0.45)], gain=0.5, send=0.5),
        Track('choir', [at(2, 3.5, 'c4+eb4+g4', 0.35)], gain=0.4, send=0.7, options={'vowel': 'oo'}),
    ], room=(4.5, 4000, 1100), wet=0.55, loudness=None, loop=False)


SONGS = {
    'title': title, 'lumerite': lumerite, 'mira': mira, 'machinery': machinery, 'ashes': ashes,
    'garden': garden, 'keeper': keeper, 'guardian': guardian, 'warden': warden, 'ilyra': ilyra,
}
STINGERS = {'victory': victory, 'ability': ability, 'rest': rest, 'death': death, 'act': act}

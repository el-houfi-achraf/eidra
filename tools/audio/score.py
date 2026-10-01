"""Scores of the EIDRA soundtrack: a compact note notation and a renderer that turns
tracks into seamless stereo loops (notes and reverb ringing past the end wrap
back onto the start).

Notation: space-separated tokens `name:beats[@velocity]`. A name is a note
(`d4`, `f#3`, `bb2`), a chord (`d3+a3+f4`) or a rest (`r`); `|` marks bars and is
ignored. Example: `d5:1.5 e5:.5 f5:1 a5:1 | g5:1.5@.8 f5:.5 e5:2`.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from dsp import MUSIC_RATE, circular, impulse, master, pan, place, resonance, reverb, seeded
from instruments import INSTRUMENTS

_STEPS = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def note(name: str) -> int:
    """MIDI number of a note name: `c4` is 60, `f#3` 54, `bb2` 46."""
    letter = name[0].lower()
    rest = name[1:]
    shift = 0
    if rest[:1] == '#':
        shift, rest = 1, rest[1:]
    elif rest[:1] == 'b' and len(rest) > 1:
        shift, rest = -1, rest[1:]
    return 12 * (int(rest) + 1) + _STEPS[letter] + shift


def chord(names: str) -> list[int]:
    return [note(n) for n in names.replace('+', ' ').split()]


@dataclass
class Event:
    beat: float
    beats: float
    notes: list[int]
    vel: float


def seq(text: str, start: float = 0.0, vel: float = 0.7, legato: float = 1.0) -> list[Event]:
    """Parses a line of notation into events, one after another from `start`."""
    events, beat = [], start
    for token in text.split():
        if token == '|':
            continue
        body, _, velocity = token.partition('@')
        name, _, length = body.partition(':')
        beats = float(length or 1)
        if name != 'r':
            events.append(Event(beat, beats * legato, chord(name), float(velocity or vel)))
        beat += beats
    return events


def at(beat: float, beats: float, names: str, vel: float = 0.7) -> Event:
    return Event(beat, beats, chord(names), vel)


def pattern(chords: list[str], beats_per: float, steps: list[tuple[float, float, int]],
            start: float = 0.0, vel: float = 0.6, octave: int = 0) -> list[Event]:
    """Arpeggiates each chord: steps are (beat offset, length, index into the chord tones
    extended by octaves)."""
    events = []
    for i, names in enumerate(chords):
        tones = chord(names)
        for offset, length, index in steps:
            tone = tones[index % len(tones)] + 12 * (index // len(tones) + octave)
            events.append(Event(start + i * beats_per + offset, length, [tone], vel))
    return events


def repeat(events: list[Event], times: int, every: float) -> list[Event]:
    return [Event(e.beat + k * every, e.beats, e.notes, e.vel) for k in range(times) for e in events]


@dataclass
class Track:
    instrument: str
    events: list[Event]
    pan: float = 0.0
    gain: float = 1.0
    send: float = 0.35
    spread: float = 0.15
    options: dict = field(default_factory=dict)
    humanize: float = 0.008


@dataclass
class Song:
    name: str
    bpm: float
    beats: float
    tracks: list[Track]
    room: tuple[float, float, float] = (3.2, 5200, 1400)
    wet: float = 0.45
    loudness: float = 0.12
    loop: bool = True

    @property
    def seconds(self) -> float:
        return self.beats * 60 / self.bpm

    def render(self, rate: int = MUSIC_RATE) -> np.ndarray:
        rng = seeded(self.name)
        n = int(round(self.seconds * rate))
        if not self.loop:
            n += int(self.room[0] * rate)
        dry = np.zeros((n, 2))
        send = np.zeros((n, 2))
        for track in self.tracks:
            make = INSTRUMENTS[track.instrument]
            bus = np.zeros((n, 2))
            for event in track.events:
                hold = event.beats * 60 / self.bpm
                start = event.beat * 60 / self.bpm + rng.normal(0, track.humanize)
                vel = float(np.clip(event.vel * rng.uniform(0.93, 1.05), 0.05, 1))
                for tone in event.notes:
                    voice = make(tone, hold, vel, rate, rng, **track.options)
                    position = track.pan + track.spread * np.clip((tone - 60) / 24, -1, 1)
                    place(bus, pan(voice, float(np.clip(position, -1, 1))),
                          max(0, int(start * rate)), self.loop)
            if track.instrument in ('strings', 'spiccato'):
                # A shared wooden body for the section.
                def body(y: np.ndarray) -> np.ndarray:
                    return y * 0.7 + resonance(y, 280, 1.5, rate) * 0.4 + resonance(y, 2800, 2, rate) * 0.15
                bus = circular(body, bus, rate) if self.loop else body(bus)
            dry += bus * track.gain
            send += bus * track.gain * track.send
        length, bright, dark = self.room
        ir = impulse(rate, length, bright, dark, self.name + '-room')
        wet = reverb(send, ir, 1.0, circular=self.loop) - send * 0.5
        mix = dry + wet * self.wet * 2
        return master(mix, rate, loudness=self.loudness, loop=self.loop)

"""Synthesized instruments of the EIDRA score. Each returns a mono note, its release
tail included: `note` is a MIDI number, `hold` the held duration in seconds and
`vel` the velocity 0..1. TODO_ART: original synthesized placeholders.
"""
from __future__ import annotations

import numpy as np

from dsp import (adsr, bandpass, expdecay, highpass, lowpass, midi, noise, pulse,
                 resonance, saw, vibrato)


def _length(hold: float, release: float, rate: int) -> int:
    return int((hold + release + 0.05) * rate)


def piano(note, hold, vel, rate, rng, release=0.3):
    """Struck strings: stretched partials, two-stage decay, hammer knock, damper."""
    f = midi(note)
    tau = 3.6 * 2 ** (-(note - 48) / 22)
    n = int(min(hold + release, 5 * tau) * rate) + int(0.05 * rate)
    t = np.arange(n) / rate
    out = np.zeros(n)
    bright = 0.35 + 0.65 * vel
    stretch = 0.00012 * 2 ** ((note - 60) / 12)
    for k in range(1, 19):
        fk = k * f * np.sqrt(1 + stretch * k * k)
        if fk > 7500:
            break
        ak = np.exp(-(k - 1) * (1.25 - bright) * 0.55) / k
        tk = tau / (1 + 0.32 * (k - 1))
        env = 0.62 * np.exp(-t / (tk * 0.22)) + 0.38 * np.exp(-t / tk)
        ph = rng.uniform(0, 6.28)
        out += ak * env * np.sin(2 * np.pi * fk * t + ph)
        if k <= 5:
            out += 0.45 * ak * env * np.sin(2 * np.pi * fk * 1.0007 * t + ph + 1)
    knock = bandpass(noise(int(0.012 * rate), rng), f * 2, min(f * 9, 9000), rate)
    out[:len(knock)] += knock * expdecay(len(knock), rate, 0.003) * 0.5 * vel
    damper = np.ones(n)
    off = t > hold
    damper[off] = np.exp(-(t[off] - hold) / max(release / 3, 0.02))
    return out * damper * vel * 0.22


def strings(note, hold, vel, rate, rng, attack=0.45, release=0.9, voices=3, bright=2400,
            tremolo=0.0):
    """A string section voice: detuned bowed saws with vibrato, softly filtered."""
    f = midi(note)
    n = _length(hold, release, rate)
    out = np.zeros(n)
    for _ in range(voices):
        det = 2 ** (rng.uniform(-0.09, 0.09) / 12)
        fr = vibrato(f * det, n, rate, 0.1, rng.uniform(4.6, 5.8), 0.35, rng)
        out += saw(fr, n, rate, rng.uniform())
    out = lowpass(out / voices, bright * (0.55 + 0.45 * vel) + f, rate)
    env = adsr(n, rate, attack, 0.3, 0.85, release, hold=hold)
    if tremolo:
        t = np.arange(n) / rate
        env *= 0.6 + 0.4 * np.abs(np.sin(np.pi * tremolo * t))
    return out * env * vel * 0.3


def spiccato(note, hold, vel, rate, rng):
    """Short bouncing bow strokes for ostinati."""
    return strings(note, min(hold, 0.12), vel, rate, rng, attack=0.012, release=0.12,
                   voices=2, bright=3200)


def cello(note, hold, vel, rate, rng, attack=0.14, release=0.45, bright=1900):
    """Solo bowed string: saw and narrow pulse, vibrato, bow noise and a wooden body."""
    f = midi(note)
    n = _length(hold, release, rate)
    fr = vibrato(f, n, rate, 0.17, rng.uniform(5.0, 5.6), 0.22, rng)
    tone = saw(fr, n, rate) * 0.8 + pulse(fr, n, rate, 0.28) * 0.2
    bow = bandpass(noise(n, rng), f * 2, min(f * 8, 9000), rate) * 0.05
    body = lowpass(tone + bow, bright + f * 0.8, rate)
    body = (body * 0.55 + resonance(body, 230, 2.5, rate) * 0.5
            + resonance(body, 620, 3.5, rate) * 0.35 + resonance(body, 1500, 3, rate) * 0.25)
    env = adsr(n, rate, attack, 0.25, 0.9, release, hold=hold)
    # A bowed swell: notes grow a little after the attack.
    t = np.arange(n) / rate
    env *= 0.85 + 0.15 * np.clip(t / max(hold, 0.2), 0, 1)
    return body * env * vel * 0.34


def violin(note, hold, vel, rate, rng):
    return cello(note, hold, vel, rate, rng, attack=0.09, release=0.4, bright=3600) * 0.8


def harp(note, hold, vel, rate, rng, tau_scale=1.0):
    """Plucked string: partials shaped by the pluck point, upper ones dying first."""
    f = midi(note)
    tau = 2.4 * 2 ** (-(note - 60) / 26) * tau_scale
    n = int(min(4.5, 4 * tau) * rate)
    t = np.arange(n) / rate
    out = np.zeros(n)
    for k in range(1, 12):
        fk = k * f
        if fk > 8000:
            break
        ak = abs(np.sin(k * np.pi * 0.27)) / k ** 1.3
        out += ak * np.exp(-t / (tau / k ** 0.65)) * np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28))
    pluck = highpass(noise(int(0.006 * rate), rng), 1500, rate)
    out[:len(pluck)] += pluck * 0.3
    return out * vel * 0.3


def pizzicato(note, hold, vel, rate, rng):
    return lowpass(harp(note, hold, vel, rate, rng, tau_scale=0.22), 2600, rate) * 1.3


def celesta(note, hold, vel, rate, rng, tau=1.5):
    """Struck bars: a few bright inharmonic partials, a glassy attack."""
    f = midi(note)
    n = int(min(4, 3 * tau) * rate)
    t = np.arange(n) / rate
    out = np.zeros(n)
    for ratio, amp, decay in ((1, 1, 1), (2.0, 0.35, 0.5), (3.01, 0.12, 0.35), (4.17, 0.22, 0.25),
                              (5.43, 0.08, 0.15)):
        if f * ratio > 12000:
            continue
        out += amp * np.exp(-t / (tau * decay)) * np.sin(2 * np.pi * f * ratio * t)
    out *= np.clip(t / 0.002, 0, 1)
    return out * vel * 0.25


def music_box(note, hold, vel, rate, rng):
    return celesta(note, hold, vel, rate, rng, tau=0.9)


def bell(note, hold, vel, rate, rng, tau=3.0):
    """A cast bell: hum, prime, minor third, fifth and nominal, slowly beating."""
    f = midi(note)
    n = int(min(8, 2.5 * tau) * rate)
    t = np.arange(n) / rate
    out = np.zeros(n)
    for ratio, amp, decay in ((0.5, 0.6, 1.4), (1, 1, 1), (1.19, 0.5, 0.7), (1.5, 0.35, 0.6),
                              (2.0, 0.45, 0.45), (2.51, 0.2, 0.3), (3.01, 0.12, 0.2)):
        out += amp * np.exp(-t / (tau * decay)) * (np.sin(2 * np.pi * f * ratio * t)
                                                     + 0.4 * np.sin(2 * np.pi * f * ratio * 1.002 * t))
    out *= np.clip(t / 0.003, 0, 1)
    return out * vel * 0.16


_VOWELS = {
    'ah': ((730, 1.0, 9), (1100, 0.55, 10), (2450, 0.22, 12)),
    'oo': ((330, 1.0, 7), (820, 0.45, 9), (2300, 0.1, 11)),
    'eh': ((540, 1.0, 9), (1750, 0.45, 11), (2500, 0.22, 12)),
}


def choir(note, hold, vel, rate, rng, vowel='oo', voices=4, attack=0.75, release=1.3):
    """Voices: detuned glottal saws with vibrato and breath, shaped by vowel formants."""
    f = midi(note)
    n = _length(hold, release, rate)
    src = np.zeros(n)
    for _ in range(voices):
        fr = vibrato(f * 2 ** (rng.uniform(-0.12, 0.12) / 12), n, rate, 0.14,
                     rng.uniform(4.5, 5.6), 0.3, rng)
        src += saw(fr, n, rate, rng.uniform())
    src = src / voices + noise(n, rng) * 0.08
    out = sum(gain * resonance(src, freq, q, rate) for freq, gain, q in _VOWELS[vowel])
    out = lowpass(out, 4500, rate)
    env = adsr(n, rate, attack, 0.4, 0.9, release, hold=hold)
    return out * env * vel * 0.9


def organ(note, hold, vel, rate, rng, release=0.4):
    """Pipe-like drawbars with a slow chorus."""
    f = midi(note)
    n = _length(hold, release, rate)
    t = np.arange(n) / rate
    out = np.zeros(n)
    for ratio, amp in ((0.5, 0.22), (1, 1), (2, 0.55), (3, 0.3), (4, 0.22), (6, 0.1), (8, 0.07)):
        if f * ratio > 9000:
            continue
        out += amp * (np.sin(2 * np.pi * f * ratio * t) + 0.5 * np.sin(2 * np.pi * f * ratio * 1.0015 * t + 1))
    env = adsr(n, rate, 0.06, 0.1, 0.92, release, hold=hold)
    return out * env * vel * 0.09


def horn(note, hold, vel, rate, rng, release=0.35):
    """Brass: a saw whose brightness follows the breath, with a small scoop into pitch."""
    f = midi(note)
    n = _length(hold, release, rate)
    t = np.arange(n) / rate
    fr = f * 2 ** ((-0.3 * np.exp(-t / 0.05) + 0.06 * np.sin(2 * np.pi * 5 * t) * np.clip(t - 0.3, 0, 1)) / 12)
    s = saw(fr, n, rate)
    env = adsr(n, rate, 0.07, 0.2, 0.8, release, hold=hold)
    dark = lowpass(s, f * 2.2, rate)
    bright = lowpass(s, f * 5 + 700 * vel, rate)
    mix = np.clip(env, 0, 1) ** 1.6 * (0.4 + 0.6 * vel)
    return (dark * (1 - mix) + bright * mix) * env * vel * 0.32


def drone(note, hold, vel, rate, rng, release=2.0):
    """A low sustained bed: sine and a filtered saw, slowly breathing."""
    f = midi(note)
    n = _length(hold, release, rate)
    t = np.arange(n) / rate
    tone = np.sin(2 * np.pi * f * t) + 0.5 * lowpass(saw(f * 1.001, n, rate), f * 3, rate)
    tone *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.11 * t + rng.uniform(0, 6))
    env = adsr(n, rate, 1.5, 0.5, 1.0, release, hold=hold)
    return tone * env * vel * 0.25


# --- Percussion --------------------------------------------------------------------


def timpani(note, hold, vel, rate, rng):
    f = midi(note)
    n = int(2.4 * rate)
    t = np.arange(n) / rate
    glide = 1 + 0.07 * np.exp(-t / 0.03)
    out = np.zeros(n)
    for ratio, amp, tau in ((1, 1, 1.3), (1.5, 0.5, 0.7), (1.99, 0.35, 0.5), (2.44, 0.2, 0.35)):
        out += amp * np.exp(-t / tau) * np.sin(2 * np.pi * np.cumsum(f * ratio * glide) / rate)
    hit = lowpass(noise(n, rng), 900, rate) * np.exp(-t / 0.035) * 1.5
    return (out + hit) * vel * 0.4


def drum(note, hold, vel, rate, rng):
    """Big low drum: a pitch-dropping membrane, its body and the slap of the skin."""
    n = int(1.2 * rate)
    t = np.arange(n) / rate
    f = midi(note) * (1 + 1.4 * np.exp(-t / 0.018))
    body = np.sin(2 * np.pi * np.cumsum(f) / rate) * np.exp(-t / 0.42)
    thump = lowpass(noise(n, rng), 320, rate) * np.exp(-t / 0.07) * 1.2
    slap = bandpass(noise(n, rng), 900, 3200, rate) * np.exp(-t / 0.012) * 0.6
    return (body + thump + slap) * vel * 0.55


def frame_drum(note, hold, vel, rate, rng):
    n = int(0.6 * rate)
    t = np.arange(n) / rate
    body = np.sin(2 * np.pi * midi(note) * (1 + 0.3 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.22)
    skin = bandpass(noise(n, rng), 200, 1100, rate) * np.exp(-t / 0.05)
    return (body + skin * 0.8) * vel * 0.45


def snare(note, hold, vel, rate, rng):
    n = int(0.4 * rate)
    t = np.arange(n) / rate
    wires = bandpass(noise(n, rng), 1800, 8000, rate) * np.exp(-t / 0.11) * 1.4
    shell = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.045)
    return (wires + shell * 0.6) * vel * 0.4


def tick(note, hold, vel, rate, rng):
    """A clockwork tick: a click and a small ringing escapement."""
    n = int(0.12 * rate)
    t = np.arange(n) / rate
    click = bandpass(noise(n, rng), 2500, 7000, rate) * np.exp(-t / 0.003) * 2
    ring = np.sin(2 * np.pi * midi(note) * t) * np.exp(-t / 0.025)
    return (click + ring * 0.5) * vel * 0.3


def shaker(note, hold, vel, rate, rng):
    n = int(0.12 * rate)
    t = np.arange(n) / rate
    env = np.clip(t / 0.01, 0, 1) * np.exp(-t / 0.035)
    return highpass(noise(n, rng), 5000, rate) * env * vel * 0.5


def swell(note, hold, vel, rate, rng):
    """A reversed cymbal: shimmering noise growing towards the next downbeat."""
    n = int(hold * rate)
    t = np.arange(n) / rate
    wash = highpass(noise(n, rng), 3500, rate) + 0.3 * bandpass(noise(n, rng), 600, 3000, rate)
    return wash * (t / max(hold, 0.01)) ** 2.5 * vel * 0.5


def gong(note, hold, vel, rate, rng):
    f = midi(note)
    n = int(6 * rate)
    t = np.arange(n) / rate
    out = np.zeros(n)
    for ratio, amp, tau in ((1, 1, 3.5), (1.41, 0.6, 2.5), (2.06, 0.45, 2), (2.73, 0.35, 1.4),
                            (3.6, 0.2, 1), (4.9, 0.12, 0.7)):
        out += amp * np.exp(-t / tau) * np.sin(2 * np.pi * f * ratio * t * (1 + 0.003 * np.exp(-t / 0.5)))
    out *= np.clip(t / 0.01, 0, 1)
    hit = lowpass(noise(n, rng), 500, rate) * np.exp(-t / 0.05)
    return (out + hit) * vel * 0.2


INSTRUMENTS = {
    'piano': piano, 'strings': strings, 'spiccato': spiccato, 'cello': cello, 'violin': violin,
    'harp': harp, 'pizzicato': pizzicato, 'celesta': celesta, 'music_box': music_box,
    'bell': bell, 'choir': choir, 'organ': organ, 'horn': horn, 'drone': drone,
    'timpani': timpani, 'drum': drum, 'frame_drum': frame_drum, 'snare': snare, 'tick': tick,
    'shaker': shaker, 'swell': swell, 'gong': gong,
}

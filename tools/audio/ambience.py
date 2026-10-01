"""Ambience beds of EIDRA's regions: seamless stereo loops of air, water, wind, embers
and chimes, mixed under the music. TODO_ART: synthesized placeholders.
"""
from __future__ import annotations

import numpy as np

from dsp import (MUSIC_RATE, bandpass, circular, highpass, impulse, lowpass, master, noise,
                 pan, place, reverb, seeded)
from instruments import bell

LENGTH = 30.0


def _slow(n: int, rate: int, rng: np.random.Generator, speed: float, depth: float) -> np.ndarray:
    """A slowly wandering 0..1 curve that loops (sum of whole-cycle sines)."""
    t = np.arange(n) / rate
    cycles = [max(1, round(speed * LENGTH * k)) for k in (1, 1.7, 2.9)]
    curve = sum(np.sin(2 * np.pi * c * t / LENGTH + rng.uniform(0, 6.28)) / (i + 1)
                for i, c in enumerate(cycles))
    return 1 - depth * (0.5 + 0.5 * curve / 1.83)


def _filtered(n: int, rate: int, rng: np.random.Generator, process) -> np.ndarray:
    """Noise shaped by a stateful filter as a seamless loop."""
    return circular(process, noise(n, rng), rate, pad=2.0)


def _wind(n: int, rate: int, rng: np.random.Generator, lo: float, hi: float, level: float) -> np.ndarray:
    """Gusts: two bands of noise whose balance and strength wander, looping seamlessly."""
    out = np.zeros((n, 2))
    for c in range(2):
        low = _filtered(n, rate, rng, lambda y: bandpass(y, lo, np.sqrt(lo * hi), rate))
        high = _filtered(n, rate, rng, lambda y: bandpass(y, np.sqrt(lo * hi), hi, rate))
        balance = _slow(n, rate, rng, 0.05, 1.0)
        gust = _slow(n, rate, rng, 0.06, 0.8)
        out[:, c] = (low * balance + high * (1 - balance) * 0.7) * gust * level * 3
    return out


def laboratory() -> np.ndarray:
    """Cold vaults: a faint hum, still air, water dripping far away, a creaking beam."""
    rng, rate = seeded('amb-lab'), MUSIC_RATE
    n = int(LENGTH * rate)
    t = np.arange(n) / rate
    hum = (np.sin(2 * np.pi * 55 * t) * 0.3 + np.sin(2 * np.pi * 110 * t) * 0.12
           + np.sin(2 * np.pi * 165.4 * t) * 0.04) * _slow(n, rate, rng, 0.05, 0.4) * 0.05
    bed = np.stack([hum, hum], axis=1)
    for c in range(2):
        air = _filtered(n, rate, rng, lambda y: lowpass(y, 500, rate))
        bed[:, c] += air * 0.12 * _slow(n, rate, rng, 0.04, 0.5)
    drips = np.zeros((n, 2))
    for _ in range(16):
        start = int(rng.uniform(0, LENGTH) * rate)
        f = rng.uniform(900, 2300)
        m = int(0.12 * rate)
        tt = np.arange(m) / rate
        plink = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.7 * (1 - np.exp(-tt / 0.012)))) / rate)
        plink *= np.exp(-tt / 0.035) * rng.uniform(0.07, 0.16)
        place(drips, pan(plink, rng.uniform(-0.8, 0.8)), start, True)
    creak = np.zeros((n, 2))
    for _ in range(2):
        start = int(rng.uniform(0, LENGTH) * rate)
        m = int(2.2 * rate)
        tt = np.arange(m) / rate
        groan = bandpass(noise(m, rng), 180, 520, rate) * np.sin(np.pi * tt / 2.2) ** 2
        groan += np.sin(2 * np.pi * (140 + 20 * np.sin(2 * np.pi * 0.7 * tt)) * tt) * np.sin(np.pi * tt / 2.2) ** 3 * 0.1
        place(creak, pan(groan * 0.12, rng.uniform(-0.6, 0.6)), start, True)
    ir = impulse(rate, 3.4, 4000, 900, 'amb-lab-room')
    wet = reverb(drips + creak, ir, 0.8, circular=True)
    return master(bed + wet, rate, loudness=0.05, compress_bus=False, loop=True)


def ashes() -> np.ndarray:
    """The rifts: wind through broken stone, embers crackling, the deep rumble of fire."""
    rng, rate = seeded('amb-ashes'), MUSIC_RATE
    n = int(LENGTH * rate)
    bed = _wind(n, rate, rng, 220, 900, 0.5)
    rumble = _filtered(n, rate, rng, lambda y: lowpass(y, 110, rate, order=4)) * 2.5
    bed += np.stack([rumble, rumble], axis=1)
    crackle = np.zeros((n, 2))
    for _ in range(110):
        start = int(rng.uniform(0, LENGTH) * rate)
        m = int(rng.uniform(0.002, 0.008) * rate)
        pop = highpass(noise(m, rng), 1800, rate) * np.exp(-np.arange(m) / m * 4) * rng.uniform(0.2, 0.9)
        place(crackle, pan(pop, rng.uniform(-0.9, 0.9)), start, True)
    ir = impulse(rate, 2.2, 5000, 1500, 'amb-ashes-room')
    mixed = bed + reverb(crackle * 0.5, ir, 0.5, circular=True)
    return master(mixed, rate, loudness=0.05, compress_bus=False, loop=True)


def garden() -> np.ndarray:
    """The garden of denial: a soft breeze, rustling leaves and far-away chimes."""
    rng, rate = seeded('amb-garden'), MUSIC_RATE
    n = int(LENGTH * rate)
    bed = _wind(n, rate, rng, 600, 2200, 0.25)
    rustle = np.zeros((n, 2))
    for _ in range(12):
        start = int(rng.uniform(0, LENGTH) * rate)
        m = int(rng.uniform(0.6, 1.5) * rate)
        tt = np.arange(m) / rate
        leaves = highpass(noise(m, rng), 3000, rate) * np.sin(np.pi * tt / tt[-1]) ** 2 * 0.3
        place(rustle, pan(leaves, rng.uniform(-0.8, 0.8)), start, True)
    chimes = np.zeros((n, 2))
    scale = [88, 91, 93, 95, 98]
    for _ in range(11):
        start = int(rng.uniform(0, LENGTH) * rate)
        tone = bell(int(rng.choice(scale)), 1, rng.uniform(0.15, 0.3), rate, rng, tau=1.6)
        place(chimes, pan(tone, rng.uniform(-0.7, 0.7)), start, True)
    ir = impulse(rate, 4.0, 6000, 1500, 'amb-garden-room')
    mixed = bed + rustle + reverb(chimes, ir, 0.8, circular=True)
    return master(mixed, rate, loudness=0.045, compress_bus=False, loop=True)


AMBIENCES = {'laboratory': laboratory, 'ashes': ashes, 'garden': garden}

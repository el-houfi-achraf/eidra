"""Sound effects of EIDRA, in the spirit of hand-drawn action-platformers: crisp,
layered and readable (a transient, a body, a tail), each with variants so
repeated actions never sound mechanical. Mono, 44.1 kHz.
TODO_ART: original synthesized placeholders; no external samples.
"""
from __future__ import annotations

import numpy as np
from scipy import signal

from dsp import (SFX_RATE as R, bandpass, fade, highpass, impulse, lowpass, midi, noise,
                 saw, seeded, sweep)
from instruments import bell, celesta, choir, gong


def _t(duration: float) -> np.ndarray:
    return np.arange(int(duration * R)) / R


def _fit(parts: list[tuple[float, np.ndarray]], duration: float) -> np.ndarray:
    """Mixes (start time, sound) layers into one buffer of `duration` seconds."""
    out = np.zeros(int(duration * R))
    for start, part in parts:
        i = int(start * R)
        if i >= len(out):
            continue
        end = min(len(out), i + len(part))
        out[i:end] += part[:end - i]
    return out


def shape(n: int, attack: float, curve: float = 2.0) -> np.ndarray:
    """Rises to a peak at `attack` (fraction of the length), then falls away."""
    k = np.linspace(0, 1, n)
    rise = np.clip(k / max(attack, 1e-3), 0, 1) ** 1.5
    fall = np.clip((1 - k) / max(1 - attack, 1e-3), 0, 1) ** curve
    return np.where(k < attack, rise, fall)


def whoosh(rng, duration, f0, f1, attack=0.3, q=0.9, curve=2.0) -> np.ndarray:
    n = int(duration * R)
    return sweep(noise(n, rng), 'bandpass', f0, f1, R, q_band=q) * shape(n, attack, curve) * 3


def thump(f0, f1, duration, tau) -> np.ndarray:
    t = _t(duration)
    f = f1 + (f0 - f1) * np.exp(-t / (tau * 0.4))
    return np.sin(2 * np.pi * np.cumsum(f) / R) * np.exp(-t / tau)


def click(rng, duration=0.004, lo=2000, hi=9000) -> np.ndarray:
    n = int(duration * R)
    return bandpass(noise(n, rng), lo, hi, R) * np.exp(-np.arange(n) / n * 5) * 4


def burst(rng, duration, lo, hi, tau) -> np.ndarray:
    t = _t(duration)
    return bandpass(noise(len(t), rng), lo, hi, R) * np.exp(-t / tau) * 3


def ring(partials, duration) -> np.ndarray:
    """Struck metal or glass: (frequency, amplitude, decay) partials."""
    t = _t(duration)
    out = np.zeros(len(t))
    for f, a, tau in partials:
        out += a * np.exp(-t / tau) * np.sin(2 * np.pi * f * t)
    return out * np.clip(t / 0.0015, 0, 1)


def glass(rng, count, spread, duration, lo=2800, hi=9000) -> np.ndarray:
    """Shards: many tiny bright pings scattered in time."""
    parts = []
    for _ in range(count):
        f = rng.uniform(lo, hi)
        parts.append((rng.uniform(0, spread) ** 1.5 / max(spread, 1e-3) ** 0.5,
                      ring([(f, rng.uniform(0.2, 1), rng.uniform(0.015, 0.06)),
                            (f * 1.47, rng.uniform(0.1, 0.4), 0.02)], 0.15)))
    return _fit(parts, duration)


def crackle(rng, count, duration, lo=1500) -> np.ndarray:
    parts = []
    for _ in range(count):
        m = int(rng.uniform(0.001, 0.006) * R)
        parts.append((rng.uniform(0, duration * 0.9),
                      highpass(noise(m, rng), lo, R) * np.exp(-np.arange(m) / m * 4) * rng.uniform(0.3, 1) * 3))
    return _fit(parts, duration)


def grains(rng, count, duration, f0, f1, tau=0.08) -> np.ndarray:
    """A shimmer: short sine grains whose pitch drifts from f0 to f1 over the sound."""
    parts = []
    for i in range(count):
        k = i / max(1, count - 1)
        f = f0 * (f1 / f0) ** k * rng.uniform(0.94, 1.06)
        parts.append((k * duration * 0.85, ring([(f, rng.uniform(0.4, 1), tau), (f * 2.01, 0.2, tau * 0.5)], tau * 4)))
    return _fit(parts, duration)


def flicker(n, rng, speed=35, depth=0.5) -> np.ndarray:
    """Irregular amplitude flutter (fire, rattles)."""
    t = np.arange(n) / R
    jitter = signal.resample(rng.standard_normal(max(8, int(n / R * speed))), n)
    return 1 - depth * (0.5 + 0.5 * np.tanh(jitter + np.sin(2 * np.pi * speed * t)))


def room(x, size=0.5, wet=0.2, seed='room', bright=6000, dark=2000) -> np.ndarray:
    ir = impulse(R, size, bright, dark, 'sfx-' + seed, predelay=0.006, stereo=False)
    tail = signal.fftconvolve(x, ir)
    out = np.zeros(len(x) + int(size * R * 0.6))
    out[:len(x)] += x * (1 - wet * 0.3)
    out[:min(len(out), len(tail))] += tail[:len(out)] * wet * 0.5
    return out


# --- Eidra -----------------------------------------------------------------------------


def swing(rng):
    d = rng.uniform(0.15, 0.19)
    staff = ring([(rng.uniform(2100, 2500), 0.05, 0.05), (rng.uniform(3300, 3700), 0.03, 0.04)], d)
    return room(_fit([(0, whoosh(rng, d, rng.uniform(2300, 2900), rng.uniform(600, 800), 0.28)),
                      (0, highpass(noise(int(d * R), rng), 6000, R) * shape(int(d * R), 0.2) * 0.3),
                      (0.03, staff)], d), 0.3, 0.12, 'swing')


def swing_heavy(rng):
    d = 0.34
    return room(_fit([(0, whoosh(rng, d, 1800, 350, 0.35)), (0, whoosh(rng, d, 650, 160, 0.45) * 0.8),
                      (0.12, thump(90, 50, 0.2, 0.08) * 0.4)], d + 0.1), 0.4, 0.15, 'heavy')


def riposte(rng):
    chime = ring([(1568, 0.5, 0.5), (2352, 0.3, 0.35), (3136, 0.2, 0.25), (4704, 0.1, 0.15)], 1.0)
    return room(_fit([(0, swing(rng)), (0.04, chime)], 1.0), 0.8, 0.3, 'riposte')


def hit(rng):
    tink = rng.uniform(2600, 3300)
    layers = [
        (0, click(rng, 0.003, 3000, 12000)),
        (0, burst(rng, 0.06, 700, 3200, 0.022) * 1.2),
        (0, thump(rng.uniform(150, 190), 65, 0.12, 0.05) * 1.1),
        (0.002, ring([(tink, 0.35, 0.05), (tink * 1.48, 0.22, 0.035), (tink * 2.1, 0.12, 0.025)], 0.15)),
        (0.004, crackle(rng, 6, 0.04, 2500) * 0.4),
    ]
    return room(_fit(layers, 0.2), 0.35, 0.12, 'hit')


def hit_armor(rng):
    base = rng.uniform(480, 560)
    clang = ring([(base, 0.5, 0.45), (base * 2.38, 0.4, 0.3), (base * 3.6, 0.3, 0.22), (base * 5.1, 0.25, 0.15),
                  (base * 7.4, 0.15, 0.08)], 0.7)
    return room(_fit([(0, click(rng, 0.004, 2000, 10000)), (0, clang), (0, burst(rng, 0.08, 1500, 6000, 0.02))],
                     0.7), 0.5, 0.2, 'armor')


def kill(rng):
    soul = sweep(noise(int(0.5 * R), rng), 'bandpass', 700, 3200, R, q_band=0.5) * shape(int(0.5 * R), 0.4) * 1.5
    return room(_fit([(0, thump(130, 38, 0.35, 0.12) * 1.3), (0, burst(rng, 0.2, 200, 2200, 0.07) * 1.2),
                      (0.05, soul * 0.6), (0.03, glass(rng, 9, 0.25, 0.4) * 0.35)], 0.65), 0.7, 0.3, 'kill')


def hurt(rng):
    return room(_fit([(0, thump(95, 32, 0.6, 0.22) * 1.6), (0, click(rng, 0.006, 1500, 9000) * 1.2),
                      (0, highpass(burst(rng, 0.08, 2500, 10000, 0.035), 3000, R)),
                      (0, lowpass(burst(rng, 0.4, 60, 600, 0.12), 500, R) * 1.2),
                      (0.01, glass(rng, 16, 0.25, 0.5) * 0.5)], 0.8), 0.7, 0.25, 'hurt')


def parry(rng):
    base = 1480
    clang = ring([(base, 0.55, 0.7), (base * 1.503, 0.4, 0.5), (base * 2.25, 0.3, 0.35), (base * 3.01, 0.25, 0.25),
                  (base * 3.99, 0.15, 0.15)], 1.2)
    return room(_fit([(0, click(rng, 0.004, 3000, 12000) * 1.4), (0, clang),
                      (0.05, grains(rng, 8, 0.4, 3000, 6000, 0.05) * 0.2)], 1.2), 0.9, 0.3, 'parry')


def dash(rng):
    d = rng.uniform(0.2, 0.25)
    return room(_fit([(0, whoosh(rng, d, rng.uniform(800, 1000), rng.uniform(2900, 3500), 0.2, 1.2)),
                      (0, highpass(noise(int(d * R), rng), 5000, R) * shape(int(d * R), 0.15) * 0.4)], d + 0.05),
                0.3, 0.1, 'dash')


def flap(rng, count=2, gap=0.05, level=1.0):
    parts = []
    for i in range(count):
        m = int(0.045 * R)
        cloth = lowpass(noise(m, rng), rng.uniform(1500, 2200), R) * shape(m, 0.25) * 2.5
        parts.append((i * gap, cloth * level * (1 - 0.25 * i)))
    return _fit(parts, gap * count + 0.06)


def jump(rng):
    return flap(rng, 2, rng.uniform(0.045, 0.06))


def double_jump(rng):
    return room(_fit([(0, flap(rng, 3, 0.04)), (0, grains(rng, 7, 0.25, 1200, 2600, 0.05) * 0.35)], 0.35),
                0.5, 0.25, 'double')


def land(rng):
    return _fit([(0, lowpass(burst(rng, 0.09, 40, 600, 0.03), 300, R) * 1.6),
                 (0, thump(110, 55, 0.06, 0.025)),
                 (0, burst(rng, 0.03, 2000, 5000, 0.008) * 0.3)], 0.12)


def land_heavy(rng):
    return room(_fit([(0, land(rng) * 1.3), (0, thump(80, 40, 0.2, 0.07) * 0.9),
                      (0.01, crackle(rng, 10, 0.2, 2000) * 0.5)], 0.3), 0.4, 0.15, 'landing')


def step_stone(rng):
    return _fit([(0, click(rng, 0.003, 1500, 6000) * 0.6),
                 (0, lowpass(burst(rng, 0.05, 80, 1600, 0.012), 1200, R) * 1.2),
                 (0, thump(rng.uniform(380, 460), 300, 0.03, 0.01) * 0.25)], 0.06)


def step_ash(rng):
    return _fit([(0, crackle(rng, int(rng.integers(6, 11)), 0.05, 1500) * 0.5),
                 (0, lowpass(burst(rng, 0.06, 60, 900, 0.015), 700, R))], 0.07)


def step_moss(rng):
    m = int(0.08 * R)
    return bandpass(noise(m, rng), 350, 1900, R) * shape(m, 0.15, 1.5) * 1.6


def focus(rng):
    d = 0.8
    t = _t(d)
    rise = 300 * 3 ** (t / d)
    tone = (np.sin(2 * np.pi * np.cumsum(rise) / R) + 0.4 * np.sin(2 * np.pi * np.cumsum(rise * 1.5) / R)
            + 0.25 * np.sin(2 * np.pi * np.cumsum(rise * 3.01) / R)) * (t / d) ** 1.6 * 0.4
    breath = sweep(noise(len(t), rng), 'bandpass', 500, 2500, R, q_band=0.7) * (t / d) ** 2 * 1.2
    return room(_fit([(0, tone), (0, breath), (0.1, grains(rng, 10, 0.9, 900, 2800, 0.06) * 0.25)], d),
                0.8, 0.3, 'focus')


def heal(rng):
    chord = sum(celesta(n, 1, 0.8, R, rng, tau=0.9) for n in (74, 78, 81, 86))
    return room(_fit([(0, whoosh(rng, 0.25, 600, 2400, 0.8) * 0.4), (0.18, chord * 1.5)], 1.6), 1.0, 0.35, 'heal')


def card_throw(rng):
    m = int(0.035 * R)
    flick = highpass(noise(m, rng), 3000, R) * shape(m, 0.08, 2.5) * 2.2
    return room(_fit([(0, flick), (0.005, ring([(rng.uniform(4600, 5400), 0.12, 0.04)], 0.1))], 0.12),
                0.3, 0.12, 'card')


def card_hit(rng):
    return _fit([(0, burst(rng, 0.03, 2000, 7000, 0.008) * 1.2),
                 (0, ring([(3800, 0.3, 0.05), (5600, 0.15, 0.03)], 0.12))], 0.13)


def card_burst(rng):
    parts = [(i * 0.025, card_throw(rng)) for i in range(5)]
    parts.append((0, whoosh(rng, 0.32, 900, 3200, 0.4) * 0.6))
    parts.append((0.05, grains(rng, 10, 0.4, 2000, 5000, 0.05) * 0.25))
    return room(_fit(parts, 0.55), 0.5, 0.2, 'cards')


def pogo(rng):
    t = _t(0.14)
    spring = np.sin(2 * np.pi * np.cumsum(300 + 500 * t / 0.14) / R) * np.exp(-t / 0.05) * 0.25
    return room(_fit([(0, ring([(2400, 0.5, 0.08), (3600, 0.3, 0.05), (5100, 0.15, 0.03)], 0.2)),
                      (0, click(rng, 0.003, 3000, 10000)), (0.01, spring)], 0.25), 0.3, 0.15, 'pogo')


def shard(rng):
    pairs = [(1568, 2093), (1760, 2349), (1319, 1976)]
    a, b = pairs[int(rng.integers(0, 3))]
    ping = lambda f: ring([(f, 0.6, 0.12), (f * 2.76, 0.15, 0.05)], 0.3)  # noqa: E731
    return room(_fit([(0, ping(a)), (0.055, ping(b) * 0.8)], 0.4), 0.5, 0.25, 'shard')


def remanence(rng):
    d = 0.7
    t = _t(d)
    tone = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 659.3 * t) * 0.6) * (t / d) ** 3 * 0.3
    hiss = bandpass(noise(len(t), rng), 1500, 6000, R) * (t / d) ** 3 * 0.6
    chime = ring([(1760, 0.4, 0.4), (2637, 0.25, 0.3)], 0.6)
    return room(_fit([(0, tone + hiss), (d - 0.02, chime)], d + 0.6), 1.2, 0.4, 'remanence')


def echo(rng):
    voice = choir(69, 0.6, 0.6, R, rng, vowel='ah', voices=3, attack=0.3, release=0.4)
    whisper = sweep(noise(int(0.8 * R), rng), 'bandpass', 900, 2600, R, q_band=0.4) * shape(int(0.8 * R), 0.5)
    return room(_fit([(0, voice * 0.6), (0, whisper * 0.5)], 1.0), 1.4, 0.45, 'echo')


def player_death(rng):
    return room(_fit([(0, hurt(rng)), (0.05, glass(rng, 30, 0.5, 1.0) * 0.6), (0, thump(70, 28, 1.0, 0.4) * 1.2),
                      (0.3, sweep(noise(int(1.0 * R), rng), 'lowpass', 2000, 200, R) * shape(int(R), 0.05) * 0.4)],
                     1.6), 1.6, 0.4, 'death')


def respawn(rng):
    return room(_fit([(0, grains(rng, 18, 1.1, 500, 2200, 0.1) * 0.5),
                      (0.2, choir(74, 0.6, 0.5, R, rng, vowel='oo', voices=3, attack=0.4, release=0.5) * 0.5)], 1.6),
                1.4, 0.4, 'respawn')


def memory(rng):
    voices = sum(choir(n, 0.8, 0.5, R, rng, vowel='oo', voices=3, attack=0.25, release=0.6) for n in (69, 73, 76))
    return room(_fit([(0, voices * 0.45), (0, bell(81, 1, 0.5, R, rng, tau=1.2))], 1.8), 1.6, 0.45, 'memory')


# --- Enemies and bosses --------------------------------------------------------------------


def enemy_alert(rng):
    return room(_fit([(0, whoosh(rng, 0.14, 2000, 4500, 0.6, 0.6) * 0.8), (0.1, click(rng, 0.004))], 0.2),
                0.3, 0.15, 'alert')


def enemy_windup(rng):
    d = 0.38
    m = int(d * R)
    t = np.arange(m) / R
    rattle = bandpass(noise(m, rng), 900, 3200, R) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 28 * t))) * (t / d) ** 1.5
    return room(rattle * 1.4, 0.3, 0.12, 'windup')


def enemy_swing(rng):
    return room(whoosh(rng, 0.21, rng.uniform(1200, 1500), 380, 0.35), 0.3, 0.12, 'eswing')


def enemy_shot(rng):
    d = 0.3
    m = int(d * R)
    fire = bandpass(noise(m, rng), 400, 2200, R) * flicker(m, rng) * shape(m, 0.15) * 1.6
    return room(_fit([(0, whoosh(rng, d, 600, 1800, 0.2) * 0.6), (0, fire), (0, crackle(rng, 8, d) * 0.4)], d),
                0.4, 0.15, 'shot')


def boss_roar(rng):
    d = 1.6
    t = _t(d)
    f = 70 * 2 ** (np.sin(2 * np.pi * 11 * t) * 0.08 + np.sin(2 * np.pi * 2.3 * t) * 0.05)
    growl = lowpass(saw(f, len(t), R) + 0.5 * saw(f * 1.5, len(t), R), 750, R)
    roar = bandpass(noise(len(t), rng), 250, 1600, R) * flicker(len(t), rng, 24, 0.6) * 1.6
    env = shape(len(t), 0.15, 1.4)
    return room(_fit([(0, (growl * 0.7 + roar + np.sin(2 * np.pi * 44 * t) * 0.4) * env)], d), 2.0, 0.35, 'roar',
                bright=3000, dark=900)


def boss_windup(rng):
    d = 0.6
    m = int(d * R)
    scrape = sweep(noise(m, rng), 'bandpass', 300, 2500, R, curve=1.4, q_band=0.5) * (np.arange(m) / m) ** 1.6 * 2.5
    return room(_fit([(0, scrape), (d - 0.05, ring([(1250, 0.12, 0.2), (1870, 0.08, 0.15)], 0.3))], d + 0.25),
                0.5, 0.2, 'bwindup')


def boss_swing(rng):
    return room(_fit([(0, whoosh(rng, 0.45, 1300, 220, 0.4)), (0, whoosh(rng, 0.45, 500, 120, 0.5) * 0.8)], 0.5),
                0.6, 0.18, 'bswing')


def boss_slam(rng):
    return room(_fit([(0, thump(62, 26, 1.2, 0.35) * 1.6), (0, lowpass(burst(rng, 0.5, 60, 3000, 0.1), 3000, R) * 1.4),
                      (0, click(rng, 0.006, 800, 6000) * 1.2), (0.03, crackle(rng, 30, 0.6, 1200) * 0.7)], 1.4),
                1.6, 0.35, 'slam', bright=3500, dark=900)


def boss_charge(rng):
    d = 0.8
    m = int(d * R)
    rumble = lowpass(noise(m, rng), 260, R) * flicker(m, rng, 18, 0.5) * shape(m, 0.25) * 3
    return room(_fit([(0, rumble), (0, whoosh(rng, d, 380, 1600, 0.6) * 0.8)], d), 0.6, 0.2, 'charge')


def boss_blink(rng):
    d = 0.5
    shimmer = grains(rng, 10, d * 0.8, 3200, 900, 0.05)[::-1]
    return room(_fit([(0, shimmer * 0.5), (d * 0.8, click(rng, 0.005, 1500, 8000) * 1.2)], d + 0.1), 0.8, 0.35,
                'blink')


def boss_rain(rng):
    parts = []
    for i in range(5):
        t = _t(0.5)
        f = 2600 - 1700 * t / 0.5 + rng.uniform(-150, 150)
        parts.append((i * 0.09, np.sin(2 * np.pi * np.cumsum(f) / R) * shape(len(t), 0.2) * 0.25))
    return room(_fit(parts, 1.0), 0.8, 0.3, 'rain')


def boss_volley(rng):
    return room(_fit([(0, whoosh(rng, 0.3, 1500, 4200, 0.3, 0.7) * 0.7),
                      (0.05, glass(rng, 4, 0.15, 0.3, 2500, 5000) * 0.6)], 0.4), 0.5, 0.2, 'volley')


def boss_nova(rng):
    return room(_fit([(0, thump(85, 40, 0.5, 0.15) * 1.4), (0, ring([(220, 0.4, 0.3), (330, 0.2, 0.2)], 0.6)),
                      (0, burst(rng, 0.15, 150, 1500, 0.05))], 0.7), 0.9, 0.25, 'nova')


def standard_plant(rng):
    flags = flap(rng, 3, 0.07, 0.7)
    return room(_fit([(0, thump(75, 35, 0.5, 0.16) * 1.4), (0, hit_armor(rng) * 0.4),
                      (0.05, flags), (0.08, bell(62, 1, 0.8, R, rng, tau=0.9) * 1.4)], 1.4), 1.2, 0.3, 'standard')


def standard_pulse(rng):
    tone = gong(43, 1, 0.9, R, rng)[:int(1.4 * R)]
    return fade(room(tone * 1.4 + _fit([(0, thump(70, 40, 0.3, 0.1) * 0.6)], 1.4), 1.2, 0.3, 'pulse'), R, 0.002, 0.3)


def command(rng):
    stab = sum(choir(n, 0.7, 0.8, R, rng, vowel='ah', voices=4, attack=0.05, release=0.5) for n in (49, 55, 61))
    swell = sweep(noise(int(0.35 * R), rng), 'bandpass', 300, 1800, R, q_band=0.6) * np.linspace(0, 1, int(0.35 * R)) ** 2
    return room(_fit([(0, swell * 1.2), (0.33, stab * 0.55), (0.33, thump(70, 35, 0.6, 0.2) * 1.2)], 1.6), 2.0, 0.4,
                'command', bright=3000, dark=900)


def gaze_punish(rng):
    cluster = ring([(1760, 0.4, 0.25), (1865, 0.35, 0.25), (2637, 0.3, 0.2), (3951, 0.15, 0.12)], 0.6)
    t = _t(0.35)
    whistle = np.sin(2 * np.pi * np.cumsum(3000 - 2000 * t / 0.35) / R) * shape(len(t), 0.2) * 0.3
    return room(_fit([(0, click(rng, 0.004, 3000, 12000)), (0, cluster), (0.08, whistle)], 0.7), 0.6, 0.25, 'gaze')


def leap(rng):
    return room(_fit([(0, whoosh(rng, 0.6, 280, 1900, 0.55, 0.8) * 1.2), (0, whoosh(rng, 0.6, 120, 500, 0.4) * 0.6)],
                     0.65), 0.6, 0.2, 'leap')


def geyser(rng):
    d = 0.75
    m = int(d * R)
    fire = bandpass(noise(m, rng), 300, 3000, R) * flicker(m, rng, 40, 0.55) * shape(m, 0.06, 1.6) * 2.2
    return room(_fit([(0, fire), (0, thump(90, 45, 0.25, 0.08)), (0.02, crackle(rng, 18, 0.6) * 0.6)], d), 0.6, 0.2,
                'geyser')


def mirror(rng):
    chord = ring([(f * c, 0.3, 0.6) for f in (1319, 1661, 1976, 2489) for c in (1, 1.003)], 1.2)
    rise = (grains(rng, 10, 0.4, 1500, 4000, 0.04) * 0.4)
    return room(_fit([(0, rise), (0.35, chord * 0.6)], 1.6), 1.4, 0.45, 'mirror')


def reflection_shatter(rng):
    return room(_fit([(0, click(rng, 0.005, 2000, 12000) * 1.3), (0, glass(rng, 28, 0.35, 0.8) * 0.8),
                      (0, burst(rng, 0.1, 3000, 10000, 0.03))], 0.8), 0.9, 0.3, 'shatter')


def boss_death(rng):
    return room(_fit([(0, boss_slam(rng)), (0.05, glass(rng, 40, 0.8, 1.5) * 0.6),
                      (0.4, grains(rng, 24, 2.0, 400, 3200, 0.12) * 0.4)], 3.0), 2.5, 0.45, 'bossdeath',
                bright=4000, dark=1000)


# --- World and interface ----------------------------------------------------------------------


def vent(rng):
    d = 1.0
    m = int(d * R)
    roar = bandpass(noise(m, rng), 200, 2500, R) * flicker(m, rng, 30, 0.5) * shape(m, 0.08, 1.2) * 2.4
    return room(_fit([(0, roar), (0, crackle(rng, 25, 0.9) * 0.5), (0, thump(70, 40, 0.3, 0.1) * 0.6)], d), 0.6, 0.2,
                'vent')


def gate_close(rng):
    return room(_fit([(0, thump(72, 34, 0.6, 0.2) * 1.5), (0, lowpass(burst(rng, 0.3, 50, 900, 0.09), 800, R) * 1.3),
                      (0.02, crackle(rng, 22, 0.6, 1200) * 0.6)], 1.0), 1.0, 0.3, 'gate')


def gate_open(rng):
    d = 1.4
    m = int(d * R)
    t = np.arange(m) / R
    grind = bandpass(noise(m, rng), 120, 700, R) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t)) * shape(m, 0.2, 1.2) * 2.4
    return room(_fit([(0, grind), (0, crackle(rng, 14, 1.2, 1000) * 0.4)], d), 0.9, 0.25, 'grind')


def anchor(rng):
    chord = sum(celesta(n, 1, 0.6, R, rng, tau=1.2) for n in (74, 78, 81))
    return room(_fit([(0, whoosh(rng, 0.3, 500, 1800, 0.7) * 0.25), (0.15, chord)], 1.8), 1.2, 0.35, 'anchor')


def dialogue(rng):
    f = rng.uniform(600, 900)
    return _fit([(0, click(rng, 0.002, 1500, 4000) * 0.4), (0, ring([(f, 0.25, 0.012)], 0.04))], 0.05)


def ui_move(rng):
    return _fit([(0, ring([(1800, 0.4, 0.012), (2700, 0.15, 0.008)], 0.04)), (0, click(rng, 0.002) * 0.2)], 0.05)


def ui_confirm(rng):
    note = lambda f: ring([(f, 0.5, 0.15), (f * 2, 0.15, 0.08)], 0.35)  # noqa: E731
    return room(_fit([(0, note(midi(76))), (0.06, note(midi(83)))], 0.45), 0.4, 0.2, 'confirm')


def ui_back(rng):
    return _fit([(0, ring([(700, 0.45, 0.03), (1050, 0.15, 0.02)], 0.08)), (0, click(rng, 0.003, 800, 3000) * 0.3)],
                0.09)


def ui_open(rng):
    return room(whoosh(rng, 0.24, 600, 3000, 0.4, 0.8) * 0.6, 0.3, 0.12, 'open')


# id: (recipe, variants, peak level)
EFFECTS = {
    'swing': (swing, 3, 0.62), 'swing-heavy': (swing_heavy, 1, 0.75), 'riposte': (riposte, 1, 0.75),
    'hit': (hit, 3, 0.85), 'hit-armor': (hit_armor, 2, 0.7), 'kill': (kill, 2, 0.8), 'hurt': (hurt, 1, 0.92),
    'parry': (parry, 1, 0.8), 'dash': (dash, 2, 0.55), 'jump': (jump, 2, 0.4),
    'double-jump': (double_jump, 1, 0.5), 'land': (land, 2, 0.45), 'land-heavy': (land_heavy, 1, 0.6),
    'step-stone': (step_stone, 4, 0.28), 'step-ash': (step_ash, 4, 0.28), 'step-moss': (step_moss, 4, 0.22),
    'focus': (focus, 1, 0.5), 'heal': (heal, 1, 0.6), 'card-throw': (card_throw, 2, 0.45),
    'card-hit': (card_hit, 1, 0.5), 'card-burst': (card_burst, 1, 0.65), 'pogo': (pogo, 1, 0.55),
    'shard': (shard, 3, 0.35), 'remanence': (remanence, 1, 0.55), 'echo': (echo, 1, 0.5),
    'player-death': (player_death, 1, 0.9), 'respawn': (respawn, 1, 0.55), 'memory': (memory, 1, 0.6),
    'enemy-alert': (enemy_alert, 1, 0.4), 'enemy-windup': (enemy_windup, 2, 0.42),
    'enemy-swing': (enemy_swing, 2, 0.5), 'enemy-shot': (enemy_shot, 2, 0.5),
    'boss-roar': (boss_roar, 1, 0.9), 'boss-windup': (boss_windup, 1, 0.5), 'boss-swing': (boss_swing, 1, 0.75),
    'boss-slam': (boss_slam, 1, 0.95), 'boss-charge': (boss_charge, 1, 0.75), 'boss-blink': (boss_blink, 1, 0.6),
    'boss-rain': (boss_rain, 1, 0.5), 'boss-volley': (boss_volley, 1, 0.6), 'boss-nova': (boss_nova, 1, 0.8),
    'standard-plant': (standard_plant, 1, 0.85), 'standard-pulse': (standard_pulse, 1, 0.65),
    'command': (command, 1, 0.85), 'gaze-punish': (gaze_punish, 1, 0.75), 'leap': (leap, 1, 0.7),
    'geyser': (geyser, 2, 0.75), 'mirror': (mirror, 1, 0.6), 'reflection-shatter': (reflection_shatter, 1, 0.7),
    'boss-death': (boss_death, 1, 0.95), 'vent': (vent, 1, 0.65), 'gate-close': (gate_close, 1, 0.8),
    'gate-open': (gate_open, 1, 0.55), 'anchor': (anchor, 1, 0.5), 'dialogue': (dialogue, 3, 0.22),
    'ui-move': (ui_move, 1, 0.28), 'ui-confirm': (ui_confirm, 1, 0.4), 'ui-back': (ui_back, 1, 0.28),
    'ui-open': (ui_open, 1, 0.32),
}


def render(name: str, variant: int) -> np.ndarray:
    recipe, _, peak = EFFECTS[name]
    x = recipe(seeded(f'{name}-{variant}'))
    x = highpass(x, 30, R)
    x = fade(x, R, 0.0015, 0.03)
    return x / (np.max(np.abs(x)) + 1e-9) * peak

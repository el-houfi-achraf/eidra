"""Signal toolkit of the EIDRA audio generator: oscillators, envelopes, filters,
synthetic reverbs, mixing, mastering and encoding. Offline and deterministic:
every random draw comes from a generator seeded by the caller.
TODO_ART: original synthesized placeholder audio; no external samples.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

MUSIC_RATE = 32000
SFX_RATE = 44100


def seeded(name: str) -> np.random.Generator:
    """A generator seeded from a name: the same name always yields the same audio."""
    seed = 2166136261
    for ch in name.encode():
        seed = ((seed ^ ch) * 16777619) & 0xFFFFFFFF
    return np.random.default_rng(seed)


def midi(note: int | float) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def times(duration: float, rate: int) -> np.ndarray:
    return np.arange(int(round(duration * rate))) / rate


# --- Envelopes -----------------------------------------------------------------


def adsr(n: int, rate: int, attack: float, decay: float, sustain: float, release: float,
         hold: float | None = None) -> np.ndarray:
    """Attack / decay / sustain until `hold` seconds, then release (curved segments)."""
    t = np.arange(n) / rate
    hold = (n / rate - release) if hold is None else hold
    env = np.empty(n)
    a = t < attack
    env[a] = (t[a] / max(attack, 1e-4)) ** 0.7
    d = (~a) & (t < attack + decay)
    env[d] = 1 - (1 - sustain) * ((t[d] - attack) / max(decay, 1e-4)) ** 0.6
    s = (~a) & (~d)
    env[s] = sustain
    held = min(hold, n / rate)
    level = np.interp(held, t, env) if n else 0
    r = t >= held
    env[r] = level * np.exp(-(t[r] - held) / max(release / 4, 1e-4))
    return env


def fade(x: np.ndarray, rate: int, fin: float = 0.004, fout: float = 0.02) -> np.ndarray:
    """Short fades at both ends so nothing clicks."""
    n = len(x)
    i, o = min(n, int(fin * rate)), min(n, int(fout * rate))
    env = np.ones(n)
    if i:
        env[:i] = np.linspace(0, 1, i)
    if o:
        env[n - o:] *= np.linspace(1, 0, o)
    return x * (env if x.ndim == 1 else env[:, None])


def expdecay(n: int, rate: int, tau: float) -> np.ndarray:
    return np.exp(-np.arange(n) / rate / max(tau, 1e-4))


# --- Oscillators -----------------------------------------------------------------


def phase_of(freq: np.ndarray | float, n: int, rate: int, start: float = 0.0) -> np.ndarray:
    """Phase in cycles of a (possibly varying) frequency."""
    if np.isscalar(freq):
        return start + np.arange(n) * (float(freq) / rate)
    return start + np.cumsum(freq) / rate


def _blep(p: np.ndarray, dt: np.ndarray) -> np.ndarray:
    out = np.zeros_like(p)
    lo = p < dt
    t = p[lo] / dt[lo]
    out[lo] = t + t - t * t - 1
    hi = p > 1 - dt
    t = (p[hi] - 1) / dt[hi]
    out[hi] = t * t + t + t + 1
    return out


def saw(freq: np.ndarray | float, n: int, rate: int, start: float = 0.0) -> np.ndarray:
    """Band-limited sawtooth (polyBLEP)."""
    ph = phase_of(freq, n, rate, start) % 1.0
    dt = np.broadcast_to(np.asarray(freq, dtype=float) / rate, (n,)).copy()
    return 2 * ph - 1 - _blep(ph, dt)


def pulse(freq: np.ndarray | float, n: int, rate: int, width: float = 0.5,
          start: float = 0.0) -> np.ndarray:
    ph = phase_of(freq, n, rate, start) % 1.0
    dt = np.broadcast_to(np.asarray(freq, dtype=float) / rate, (n,)).copy()
    out = np.where(ph < width, 1.0, -1.0)
    out += _blep(ph, dt)
    out -= _blep((ph + 1 - width) % 1.0, dt)
    return out


def sine(freq: np.ndarray | float, n: int, rate: int, start: float = 0.0) -> np.ndarray:
    return np.sin(2 * np.pi * phase_of(freq, n, rate, start))


def vibrato(base: float, n: int, rate: int, depth: float, speed: float, delay: float,
            rng: np.random.Generator) -> np.ndarray:
    """Frequency curve with a delayed, slightly irregular vibrato (depth in semitones)."""
    t = np.arange(n) / rate
    onset = np.clip((t - delay) / 0.4, 0, 1)
    wobble = np.sin(2 * np.pi * speed * t + rng.uniform(0, 6.28))
    wobble += 0.3 * np.sin(2 * np.pi * speed * 0.53 * t + rng.uniform(0, 6.28))
    return base * 2 ** (depth * onset * wobble / 12)


# --- Filters ----------------------------------------------------------------------


def _sos(kind: str, cutoff, rate: int, order: int = 2):
    nyq = rate / 2
    if kind == 'bandpass':
        lo, hi = cutoff
        return signal.butter(order, [max(20, lo) / nyq, min(hi, nyq * 0.95) / nyq], 'bandpass', output='sos')
    return signal.butter(order, min(cutoff, nyq * 0.95) / nyq, kind, output='sos')


def lowpass(x: np.ndarray, cutoff: float, rate: int, order: int = 2) -> np.ndarray:
    return signal.sosfilt(_sos('lowpass', cutoff, rate, order), x, axis=0)


def highpass(x: np.ndarray, cutoff: float, rate: int, order: int = 2) -> np.ndarray:
    return signal.sosfilt(_sos('highpass', cutoff, rate, order), x, axis=0)


def bandpass(x: np.ndarray, lo: float, hi: float, rate: int, order: int = 2) -> np.ndarray:
    return signal.sosfilt(_sos('bandpass', (lo, hi), rate, order), x, axis=0)


def resonance(x: np.ndarray, freq: float, q: float, rate: int) -> np.ndarray:
    """A single resonant band (peaking), used for bodies and formants."""
    b, a = signal.iirpeak(min(freq, rate * 0.45), q, fs=rate)
    return signal.lfilter(b, a, x, axis=0)


def sweep(x: np.ndarray, kind: str, start: float, end: float, rate: int, curve: float = 1.0,
          q_band: float = 0.6, block: int = 256) -> np.ndarray:
    """Time-varying filter (cutoff glides from `start` to `end`), block by block."""
    n = len(x)
    out = np.zeros(n)
    zi = None
    for i in range(0, n, block):
        k = (i / max(1, n - 1)) ** curve
        f = start * (end / start) ** k
        if kind == 'bandpass':
            sos = _sos('bandpass', (f * (1 - q_band / 2), f * (1 + q_band / 2)), rate)
        else:
            sos = _sos(kind, f, rate)
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return out


def noise(n: int, rng: np.random.Generator, color: str = 'white') -> np.ndarray:
    w = rng.standard_normal(n)
    if color == 'pink':
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        return signal.lfilter(b, a, w) * 4
    if color == 'brown':
        out = np.cumsum(w)
        out -= signal.savgol_filter(out, 4001 if n > 4001 else (n // 2) * 2 - 1, 1) if n > 9 else 0
        return out / (np.max(np.abs(out)) + 1e-9)
    return w * 0.35


# --- Space ----------------------------------------------------------------------------


def impulse(rate: int, length: float, bright: float, dark: float, seed: str,
            predelay: float = 0.012, stereo: bool = True) -> np.ndarray:
    """Synthetic room: early reflections and a diffuse tail that darkens as it decays."""
    rng = seeded(seed)
    n = int(length * rate)
    t = np.arange(n) / rate
    channels = []
    for c in range(2 if stereo else 1):
        tail = rng.standard_normal(n) * np.exp(-t * 6.9 / length)
        brightened = lowpass(tail, bright, rate)
        darkened = lowpass(tail, dark, rate)
        m = np.clip(t / (length * 0.6), 0, 1)
        ir = brightened * (1 - m) + darkened * m
        ir *= np.clip(t / 0.02, 0, 1)
        start = int(predelay * rate)
        ir = np.concatenate([np.zeros(start), ir])[:n]
        for k in range(6):
            at = int(rate * (predelay + rng.uniform(0.003, 0.05)))
            if at < n:
                ir[at] += rng.uniform(0.2, 0.5) * (1 if (k + c) % 2 else -1)
        channels.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.stack(channels, axis=1) if stereo else channels[0]


def reverb(x: np.ndarray, ir: np.ndarray, wet: float, circular: bool = False) -> np.ndarray:
    """Convolves with an impulse response. Circular wraps the tail onto the start (loops)."""
    stereo_in = x if x.ndim == 2 else np.stack([x, x], axis=1)
    ir2 = ir if ir.ndim == 2 else np.stack([ir, ir], axis=1)
    n = len(stereo_in)
    out = np.zeros_like(stereo_in)
    for c in range(2):
        full = signal.fftconvolve(stereo_in[:, c], ir2[:, c])
        if circular:
            wrapped = full[:n].copy()
            tail = full[n:]
            while len(tail):
                take = min(n, len(tail))
                wrapped[:take] += tail[:take]
                tail = tail[take:]
            out[:, c] = wrapped
        else:
            out[:, c] = full[:n]
    dry = stereo_in
    return dry * (1 - wet * 0.5) + out * wet


def pan(x: np.ndarray, position: float) -> np.ndarray:
    """Equal-power pan of a mono signal: -1 left, 1 right."""
    a = (position + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def place(target: np.ndarray, sound: np.ndarray, at: int, wrap: bool) -> None:
    """Adds `sound` into `target` from sample `at`; past the end it wraps (loops) or is cut."""
    n = len(target)
    end = at + len(sound)
    if end <= n:
        target[at:end] += sound
        return
    keep = n - at
    target[at:] += sound[:keep]
    if wrap:
        rest = sound[keep:]
        while len(rest):
            take = min(n, len(rest))
            target[:take] += rest[:take]
            rest = rest[take:]


# --- Mastering and files -----------------------------------------------------------------


def compress(x: np.ndarray, rate: int, threshold: float = 0.35, ratio: float = 3.0,
             release: float = 0.25) -> np.ndarray:
    """Gentle bus compression on a smoothed envelope, then a soft knee limiter."""
    level = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    b, a = signal.butter(1, 1 / (release * rate) * 2)
    env = signal.filtfilt(b, a, level)
    gain = np.ones_like(env)
    over = env > threshold
    gain[over] = (threshold * (env[over] / threshold) ** (1 / ratio)) / env[over]
    y = x * (gain[:, None] if x.ndim == 2 else gain)
    return np.tanh(y * 1.1) / np.tanh(1.1)


def circular(process, x: np.ndarray, rate: int, pad: float = 1.5) -> np.ndarray:
    """Runs a stateful filter over a loop as if it had always been playing: the end of the
    loop primes the filter, so the seam does not click."""
    p = min(len(x), int(pad * rate))
    return process(np.concatenate([x[-p:], x]))[p:]


def master(x: np.ndarray, rate: int, peak: float = 0.89, loudness: float | None = None,
           compress_bus: bool = True, loop: bool = False) -> np.ndarray:
    """High-pass rumble, compress, then set the level by RMS (`loudness`) under a peak ceiling."""
    def chain(y: np.ndarray) -> np.ndarray:
        y = highpass(y, 36, rate)
        return compress(y, rate) if compress_bus else y
    y = circular(chain, x, rate) if loop else chain(x)
    if loudness is not None:
        rms = np.sqrt(np.mean(y ** 2)) + 1e-9
        y = y * (loudness / rms)
    top = np.max(np.abs(y)) + 1e-9
    if top > peak or loudness is None:
        y = y * (peak / top)
    return y


def write(destination: Path, x: np.ndarray, rate: int) -> list[Path]:
    """Writes OGG Vorbis (primary) and MP3 (fallback) atomically; refuses empty output."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    data = np.clip(x, -1, 1).astype(np.float32)
    written = []
    channels = data.shape[1] if data.ndim == 2 else 1
    # compression_level: 0 = best quality, 1 = smallest file.
    for ext, fmt, subtype, level in (('ogg', 'OGG', 'VORBIS', 0.7), ('mp3', 'MP3', 'MPEG_LAYER_III', 0.6)):
        final = destination.with_suffix('.' + ext)
        temporary = final.with_name(final.stem + '.new.' + ext)
        options = {'compression_level': level}
        if fmt == 'MP3':
            options['bitrate_mode'] = 'VARIABLE'
        with sf.SoundFile(temporary, 'w', rate, channels, subtype, format=fmt, **options) as out:
            out.write(data)
        if temporary.stat().st_size < 200:
            raise RuntimeError(f'Empty encoded audio: {final}')
        temporary.replace(final)
        written.append(final)
    return written

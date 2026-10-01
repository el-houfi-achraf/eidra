"""Regenerates EIDRA's soundtrack, stingers, ambience beds and sound effects into
public/audio (OGG Vorbis, MP3 fallback). Deterministic: the same sources always
produce the same audio. Requires tools/requirements-audio.txt.

    python3 tools/generate_audio.py            # everything
    python3 tools/generate_audio.py sfx music  # some groups only

TODO_ART: original synthesized placeholders; no external samples.
"""
from __future__ import annotations

import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'audio'))

import ambience  # noqa: E402
import music  # noqa: E402
import sfx  # noqa: E402
from dsp import MUSIC_RATE, SFX_RATE, write  # noqa: E402

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'audio'
GROUPS = ('music', 'stingers', 'ambience', 'sfx')


def _song(job: tuple[str, str]) -> list[Path]:
    group, name = job
    table = music.SONGS if group == 'music' else music.STINGERS
    return write(ROOT / group / name, table[name]().render(), MUSIC_RATE)


def _ambience(name: str) -> list[Path]:
    return write(ROOT / 'ambience' / name, ambience.AMBIENCES[name](), MUSIC_RATE)


def _effect(job: tuple[str, int]) -> list[Path]:
    name, variant = job
    return write(ROOT / 'sfx' / f'{name}-{variant}', sfx.render(name, variant), SFX_RATE)


def main(groups: list[str]) -> None:
    unknown = [g for g in groups if g not in GROUPS]
    if unknown:
        raise SystemExit(f'Unknown groups {unknown}; choose among {GROUPS}')
    written: list[Path] = []
    with ProcessPoolExecutor() as pool:
        if 'music' in groups:
            written += sum(pool.map(_song, [('music', n) for n in music.SONGS]), [])
        if 'stingers' in groups:
            written += sum(pool.map(_song, [('stingers', n) for n in music.STINGERS]), [])
        if 'ambience' in groups:
            written += sum(pool.map(_ambience, ambience.AMBIENCES), [])
        if 'sfx' in groups:
            jobs = [(n, v) for n, (_, count, _) in sfx.EFFECTS.items() for v in range(1, count + 1)]
            written += sum(pool.map(_effect, jobs), [])
    # Files of a regenerated group that no source produces any more are stale.
    keep = {p.resolve() for p in written}
    for group in groups:
        for stale in (ROOT / group).glob('*'):
            if stale.is_file() and stale.resolve() not in keep:
                stale.unlink()
    total = sum(p.stat().st_size for p in written)
    print(f'{len(written)} files, {total / 1e6:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1:] or list(GROUPS))

"""Package the tracked source, tested production build and complete Git history."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

root = Path(__file__).resolve().parents[1]
destination = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent / "EIDRA-0.1.0-prelude.zip"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=root)


if git("status", "--porcelain").strip():
    raise SystemExit("Commit the reviewed changes before packaging a release.")
if not (root / "dist/index.html").is_file():
    raise SystemExit("Missing production build. Run npm run build first.")

sources = [Path(p) for p in git("ls-files", "-z").decode().split("\0") if p]
production = sorted(p.relative_to(root) for p in (root / "dist").rglob("*") if p.is_file())
if any((root / p).stat().st_size > 25 * 1024 * 1024 for p in production):
    raise SystemExit("An asset exceeds the Cloudflare Pages single-file budget.")

with tempfile.TemporaryDirectory(prefix="eidra-release-") as temp:
    bundle = Path(temp) / "eidra-history.bundle"
    git("bundle", "create", str(bundle), "--all")
    git("bundle", "verify", str(bundle))
    temporary = destination.with_suffix(".zip.tmp")
    hashes = {}
    with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for relative in sorted(set(sources + production)):
            archive.write(root / relative, "eidra/" + relative.as_posix())
            hashes[relative.as_posix()] = hashlib.sha256((root / relative).read_bytes()).hexdigest()
        archive.write(bundle, "eidra/eidra-history.bundle")
        archive.writestr("eidra/RELEASE.json", json.dumps({
            "version": "0.1.0-prelude",
            "commit": git("rev-parse", "HEAD").decode().strip(),
            "scope": "Playable laboratory prototype; not the complete campaign",
            "sha256": hashes,
        }, indent=2) + "\n")
    with zipfile.ZipFile(temporary) as archive:
        if archive.testzip() is not None:
            raise SystemExit("Archive integrity check failed.")
    temporary.replace(destination)
print(json.dumps({"file": str(destination), "bytes": destination.stat().st_size,
                  "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}))

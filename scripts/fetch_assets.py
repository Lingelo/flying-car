#!/usr/bin/env python3
"""Downloads the CC0 textures listed in src/render/textureManifest.json from Poly Haven,
recompresses them for the web (diffuse/normal 1024 px, or 2048 px for entries with "res": "2k";
ARM 512 px) into public/assets/textures/,
and refreshes their entries in public/assets/CREDITS.md.

Usage: python3 scripts/fetch_assets.py   (needs network access and Pillow)
"""
import io
import json
import pathlib
import urllib.request

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "src/render/textureManifest.json").read_text())
OUT = ROOT / "public/assets/textures"
API = "https://api.polyhaven.com"
# Poly Haven map name -> (our suffix, size, JPEG quality)
MAPS = {"Diffuse": ("diff", 1024, 82), "nor_gl": ("nor", 1024, 90), "arm": ("arm", 512, 85)}


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "flying-car-asset-fetch"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    credits = []
    for t in MANIFEST["textures"]:
        files = json.loads(get(f"{API}/files/{t['polyhaven']}"))
        info = json.loads(get(f"{API}/info/{t['polyhaven']}"))
        res = t.get("res", "1k")
        for ph, (suffix, size, quality) in MAPS.items():
            if res == "2k" and suffix != "arm":
                size *= 2
            url = files[ph][res]["jpg"]["url"]
            image = Image.open(io.BytesIO(get(url))).convert("RGB")
            if image.width != size:
                image = image.resize((size, size), Image.LANCZOS)
            image.save(OUT / f"{t['id']}_{suffix}.jpg", quality=quality, optimize=True)
        authors = ", ".join(info.get("authors", {}).keys()) or "Poly Haven"
        credits.append(f"| `textures/{t['id']}_*.jpg` | https://polyhaven.com/a/{t['polyhaven']} | {authors} | CC0 |")
        print("ok", t["id"])

    path = ROOT / "public/assets/CREDITS.md"
    lines = [l for l in path.read_text().splitlines() if "`textures/" not in l]
    at = next(i for i, l in enumerate(lines) if l.startswith("|---")) + 1
    path.write_text("\n".join(lines[:at] + credits + lines[at:]) + "\n")


if __name__ == "__main__":
    main()

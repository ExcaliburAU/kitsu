#!/usr/bin/env python3
"""Generate Conduit app icon assets from assets/conduit-icon.png."""

from __future__ import annotations

import struct
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
PUBLIC = ROOT / "public"
ELECTRON = ROOT / "electron"
SOURCE = ROOT / "assets" / "conduit-icon.png"

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Conduit">
  <defs>
    <linearGradient id="c" x1="512" y1="160" x2="512" y2="864" gradientUnits="userSpaceOnUse">
      <stop stop-color="#5ff0d0"/>
      <stop offset="1" stop-color="#12b8a8"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="220" fill="#14161a"/>
  <g fill="none" stroke="url(#c)" stroke-linecap="round" stroke-linejoin="round">
    <path stroke-width="92" d="M690 300c-48-70-130-116-222-116-152 0-276 124-276 276s124 276 276 276c92 0 174-46 222-116"/>
    <path stroke-width="46" d="M638 360c-34-48-90-80-154-80-106 0-192 86-192 192s86 192 192 192c64 0 120-32 154-80"/>
    <circle cx="690" cy="300" r="34" fill="#14161a" stroke="url(#c)" stroke-width="28"/>
    <circle cx="690" cy="724" r="34" fill="#14161a" stroke="url(#c)" stroke-width="28"/>
    <circle cx="292" cy="512" r="28" fill="#14161a" stroke="url(#c)" stroke-width="24"/>
  </g>
</svg>
"""


def load_source() -> Image.Image:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing logo source: {SOURCE}")
    return Image.open(SOURCE).convert("RGBA")


def square_pad(src: Image.Image, fill=(20, 22, 26, 255)) -> Image.Image:
    """Fit the logo into a square canvas without stretching (pad or center-crop)."""
    w, h = src.size
    if w == h:
        return src

    # Prefer center-crop when the asset is a near-square icon on a wider/taller canvas.
    # Padding leaves empty bars that look wrong in the circular rail orb.
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return src.crop((left, top, left + side, top + side))


def make_icon(src: Image.Image, size: int) -> Image.Image:
    return src.resize((size, size), Image.Resampling.LANCZOS)


def png_bytes(im: Image.Image) -> bytes:
    buf = BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def write_ico(path: Path, images: list[Image.Image]) -> None:
    offset = 6 + 16 * len(images)
    header = struct.pack("<HHH", 0, 1, len(images))
    dir_entries = b""
    data = b""
    for im in images:
        raw = png_bytes(im)
        w = 0 if im.size[0] >= 256 else im.size[0]
        h = 0 if im.size[1] >= 256 else im.size[1]
        dir_entries += struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(raw), offset)
        data += raw
        offset += len(raw)
    path.write_bytes(header + dir_entries + data)


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    ELECTRON.mkdir(parents=True, exist_ok=True)

    src = square_pad(load_source())

    for size in (16, 32, 48, 64, 128, 256, 512):
        make_icon(src, size).save(BUILD / f"icon-{size}.png")

    make_icon(src, 512).save(BUILD / "icon.png")
    make_icon(src, 256).save(PUBLIC / "icon.png")
    make_icon(src, 256).save(PUBLIC / "icon-256.png")
    make_icon(src, 512).save(ELECTRON / "icon.png")
    make_icon(src, 32).save(PUBLIC / "favicon-32.png")
    make_icon(src, 16).save(PUBLIC / "favicon-16.png")

    (BUILD / "icon.svg").write_text(SVG, encoding="utf-8")
    (PUBLIC / "icon.svg").write_text(SVG, encoding="utf-8")

    ico_sizes = [16, 32, 48, 64, 128, 256]
    ico_images = [make_icon(src, s) for s in ico_sizes]
    write_ico(BUILD / "icon.ico", ico_images)
    write_ico(ELECTRON / "icon.ico", ico_images)

    print(f"Wrote Conduit icons from {SOURCE} ({src.size[0]}x{src.size[1]} padded)")


if __name__ == "__main__":
    main()

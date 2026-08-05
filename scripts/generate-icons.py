#!/usr/bin/env python3
"""Generate Kitsu app icon assets from assets/kitsu-icon.png."""

from __future__ import annotations

import struct
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
PUBLIC = ROOT / "public"
ELECTRON = ROOT / "electron"
SOURCE = ROOT / "assets" / "kitsu-icon.png"

SVG = (ROOT / "build" / "icon.svg").read_text(encoding="utf-8")



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

    print(f"Wrote Kitsu icons from {SOURCE} ({src.size[0]}x{src.size[1]} padded)")


if __name__ == "__main__":
    main()

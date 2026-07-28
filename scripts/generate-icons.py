#!/usr/bin/env python3
"""Generate Relay app icon assets (PNG / SVG / ICO)."""

from __future__ import annotations

import os
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
PUBLIC = ROOT / "public"
ELECTRON = ROOT / "electron"

BLURPLE = (88, 101, 242, 255)
WHITE = (255, 255, 255, 255)

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Relay">
  <rect width="512" height="512" rx="164" ry="164" fill="#5865F2"/>
  <circle cx="256" cy="256" r="77" fill="#FFFFFF"/>
</svg>
"""


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = max(1, size // 32)
    radius = int(size * 0.32)
    box = [pad, pad, size - 1 - pad, size - 1 - pad]
    draw.rounded_rectangle(box, radius=radius, fill=BLURPLE)
    cr = size * 0.15
    cx = cy = size / 2
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=WHITE)
    return img


def png_bytes(im: Image.Image) -> bytes:
    buf = BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def write_ico(path: Path, sizes: list[int]) -> None:
    images = [make_icon(s) for s in sizes]
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

    for size in (16, 32, 48, 64, 128, 256, 512):
        make_icon(size).save(BUILD / f"icon-{size}.png")

    make_icon(512).save(BUILD / "icon.png")
    make_icon(256).save(PUBLIC / "icon.png")
    make_icon(32).save(PUBLIC / "favicon-32.png")
    make_icon(16).save(PUBLIC / "favicon-16.png")

    (BUILD / "icon.svg").write_text(SVG, encoding="utf-8")
    (PUBLIC / "icon.svg").write_text(SVG, encoding="utf-8")

    ico_sizes = [16, 32, 48, 64, 128, 256]
    write_ico(BUILD / "icon.ico", ico_sizes)
    write_ico(ELECTRON / "icon.ico", ico_sizes)

    print("Generated Relay icons in build/, public/, electron/")


if __name__ == "__main__":
    main()

"""Render the existing Apogee star as browser and Apple icons without extra dependencies."""

from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET
import zlib

ROOT = Path(__file__).resolve().parents[1]
STAR = ROOT / "make-it-fly-current/public/brand/apogee-star.svg"
APP = ROOT / "make-it-fly-current/app"
NAVY = (10, 28, 51)
CREAM = (235, 225, 200)
SAMPLES = 4


def inside_polygon(x, y, points):
    inside = False
    for index, (x1, y1) in enumerate(points):
        x2, y2 = points[(index + 1) % len(points)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def png_chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))


def render(size, points):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            star_samples = 0
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    px = (x + (sx + 0.5) / SAMPLES) * 64 / size
                    py = (y + (sy + 0.5) / SAMPLES) * 64 / size
                    star_samples += inside_polygon(px, py, points)
            weight = star_samples / (SAMPLES * SAMPLES)
            rows.extend(round(NAVY[channel] * (1 - weight) + CREAM[channel] * weight) for channel in range(3))
    header = b"\x89PNG\r\n\x1a\n"
    body = png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    body += png_chunk(b"IDAT", zlib.compress(bytes(rows), 9))
    body += png_chunk(b"IEND", b"")
    return header + body


path = ET.parse(STAR).getroot().find("{http://www.w3.org/2000/svg}path")
if path is None:
    raise RuntimeError("Apogee star path not found")
coordinates = [int(value) for value in re.findall(r"-?\d+", path.attrib["d"])]
points = [(12.7 + x * 0.055, 8 + y * 0.055) for x, y in zip(coordinates[::2], coordinates[1::2])]
if len(points) != 16:
    raise RuntimeError("Unexpected Apogee star geometry")

(APP / "icon.png").write_bytes(render(64, points))
(APP / "apple-icon.png").write_bytes(render(180, points))

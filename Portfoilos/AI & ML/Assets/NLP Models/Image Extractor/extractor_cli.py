#!/usr/bin/env python3
"""
extractor_cli.py
-----------------------------------------------------------------------------
Command-line mirror of extractor-engine.js: renders a line of text with the
5x7 bitmap font in Glyph Library/font-5x7.txt, optionally flips a few pixels
to simulate noise, then reads it back with a nearest-neighbor classifier
(Hamming distance against every known glyph). Same honest scope as the
browser version: fixed-pitch, single font, single line -- it reads text this
tool rendered, not arbitrary photos.

Usage:
    python3 extractor_cli.py "HELLO WORLD"
    python3 extractor_cli.py "HELLO WORLD" --noise 0.06 --seed 7
    python3 extractor_cli.py "HELLO WORLD" --save-ppm out.ppm
    python3 extractor_cli.py --load-ppm out.ppm --chars 11
"""
import argparse
import random
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
FONT_PATH = BASE_DIR / "Glyph Library" / "font-5x7.txt"

GLYPH_WIDTH = 5
GLYPH_HEIGHT = 7
GAP = 1
CELL_WIDTH = GLYPH_WIDTH + GAP


def load_font():
    glyphs = {}
    with open(FONT_PATH, encoding="utf-8") as f:
        lines = [line.rstrip("\n") for line in f]
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("CHAR "):
            name = line[5:].strip()
            ch = " " if name == "SPACE" else name
            rows = lines[i + 1:i + 1 + GLYPH_HEIGHT]
            glyphs[ch] = rows
            i += 1 + GLYPH_HEIGHT
        else:
            i += 1
    return glyphs


GLYPHS = load_font()
TEMPLATES = [
    (ch, [1 if c == "#" else 0 for row in rows for c in row])
    for ch, rows in GLYPHS.items()
]


def render_text(text):
    chars = list(text.upper())
    width = max(1, len(chars) * CELL_WIDTH - GAP)
    grid = [[0] * width for _ in range(GLYPH_HEIGHT)]
    for index, ch in enumerate(chars):
        rows = GLYPHS.get(ch, GLYPHS[" "])
        x_offset = index * CELL_WIDTH
        for y in range(GLYPH_HEIGHT):
            for x in range(GLYPH_WIDTH):
                grid[y][x_offset + x] = 1 if rows[y][x] == "#" else 0
    return {"width": width, "height": GLYPH_HEIGHT, "grid": grid, "char_count": len(chars)}


def add_noise(rendered, rate, rng):
    grid = [row[:] for row in rendered["grid"]]
    for y in range(rendered["height"]):
        for x in range(rendered["width"]):
            if rng.random() < rate:
                grid[y][x] = 0 if grid[y][x] else 1
    return {**rendered, "grid": grid}


def slice_cell(rendered, cell_index):
    x_offset = cell_index * CELL_WIDTH
    bits = []
    for y in range(GLYPH_HEIGHT):
        for x in range(GLYPH_WIDTH):
            bits.append(rendered["grid"][y][x_offset + x])
    return bits


def hamming(a, b):
    return sum(1 for x, y in zip(a, b) if x != y)


def classify_cell(bits):
    best_char, best_dist = None, None
    for char, template_bits in TEMPLATES:
        d = hamming(bits, template_bits)
        if best_dist is None or d < best_dist:
            best_char, best_dist = char, d
    return best_char, best_dist


def extract_text(rendered):
    results = []
    for i in range(rendered["char_count"]):
        bits = slice_cell(rendered, i)
        char, dist = classify_cell(bits)
        results.append((char, dist))
    text = "".join(c for c, _ in results)
    return text, results


def print_grid(rendered):
    for row in rendered["grid"]:
        print("".join("#" if v else "." for v in row))


def save_ppm(rendered, path):
    width, height = rendered["width"], rendered["height"]
    with open(path, "w", encoding="ascii") as f:
        f.write(f"P3\n{width} {height}\n255\n")
        for row in rendered["grid"]:
            for v in row:
                color = "0 0 0" if v else "255 255 255"
                f.write(color + "\n")


def load_ppm(path):
    with open(path, encoding="ascii") as f:
        tokens = f.read().split()
    if tokens[0] != "P3":
        raise ValueError("Only plain P3 PPM files are supported.")
    width, height, maxval = int(tokens[1]), int(tokens[2]), int(tokens[3])
    values = tokens[4:]
    grid = [[0] * width for _ in range(height)]
    idx = 0
    for y in range(height):
        for x in range(width):
            r = int(values[idx])
            idx += 3
            grid[y][x] = 0 if r > maxval // 2 else 1
    return {"width": width, "height": height, "grid": grid}


def main():
    parser = argparse.ArgumentParser(description="Render text with the 5x7 font, then read it back via nearest-neighbor OCR.")
    parser.add_argument("text", nargs="?", help="Text to render and extract (uppercased; letters, digits, spaces).")
    parser.add_argument("--noise", type=float, default=0.0, help="Probability of flipping each pixel before extraction (0-1).")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for --noise, for reproducible runs.")
    parser.add_argument("--save-ppm", metavar="PATH", help="Save the rendered (post-noise) bitmap as a plain PPM file.")
    parser.add_argument("--load-ppm", metavar="PATH", help="Skip rendering and extract from this PPM file instead.")
    parser.add_argument("--chars", type=int, help="Character count to expect when using --load-ppm.")
    args = parser.parse_args()

    rng = random.Random(args.seed)

    if args.load_ppm:
        if not args.chars:
            parser.error("--load-ppm requires --chars (how many glyph cells wide the image is).")
        rendered = load_ppm(args.load_ppm)
        rendered["char_count"] = args.chars
    else:
        if not args.text:
            parser.error("Provide TEXT, or use --load-ppm with --chars.")
        rendered = render_text(args.text)
        if args.noise > 0:
            rendered = add_noise(rendered, args.noise, rng)
        if args.save_ppm:
            save_ppm(rendered, args.save_ppm)
            print(f"Saved bitmap to {args.save_ppm}")

    print("Rendered bitmap:")
    print_grid(rendered)

    text, results = extract_text(rendered)
    print("\nExtracted text:", repr(text))
    print("\nPer-character match distance (0 = exact):")
    for char, dist in results:
        print(f"  {char!r}: distance {dist}")


if __name__ == "__main__":
    main()

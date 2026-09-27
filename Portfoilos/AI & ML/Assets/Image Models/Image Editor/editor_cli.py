#!/usr/bin/env python3
"""
editor_cli.py
-----------------------------------------------------------------------------
Command-line mirror of editor-engine.js: the exact same from-scratch pixel
filters and 3x3 convolution kernels (grayscale, invert, sepia, threshold,
flips, rotate, crop, box blur, sharpen, emboss, Sobel edges), applied to a
real PPM (P3, plain ASCII) image file. No Pillow, no numpy -- plain nested
loops over Python lists, same as the JS version operates on a flat array.

Usage:
    python3 editor_cli.py sample.ppm grayscale out.ppm
    python3 editor_cli.py sample.ppm edges out.ppm
    python3 editor_cli.py sample.ppm crop out.ppm --x 4 --y 4 --w 16 --h 16
    python3 editor_cli.py --make-sample sample.ppm --size 32
"""
import argparse


def read_ppm(path):
    with open(path, encoding="ascii") as f:
        tokens = f.read().split()
    if tokens[0] != "P3":
        raise ValueError("Only plain P3 PPM files are supported.")
    width, height, maxval = int(tokens[1]), int(tokens[2]), int(tokens[3])
    values = [int(v) for v in tokens[4:4 + width * height * 3]]
    pixels = []
    for i in range(0, len(values), 3):
        pixels.append([values[i], values[i + 1], values[i + 2]])
    return {"width": width, "height": height, "pixels": pixels}


def write_ppm(image, path):
    with open(path, "w", encoding="ascii") as f:
        f.write(f"P3\n{image['width']} {image['height']}\n255\n")
        for r, g, b in image["pixels"]:
            f.write(f"{clamp(r)} {clamp(g)} {clamp(b)}\n")


def clamp(v):
    return max(0, min(255, round(v)))


def make_sample(size):
    """A small procedural test image (no external asset needed): a diagonal
    gradient with a checkerboard overlay, enough structure to see every
    filter do something visible."""
    pixels = []
    for y in range(size):
        for x in range(size):
            base = int(255 * (x + y) / (2 * size - 2))
            checker = 40 if ((x // 4) + (y // 4)) % 2 == 0 else 0
            pixels.append([clamp(base - checker), clamp(base), clamp(255 - base + checker)])
    return {"width": size, "height": size, "pixels": pixels}


def idx(image, x, y):
    x = max(0, min(image["width"] - 1, x))
    y = max(0, min(image["height"] - 1, y))
    return image["pixels"][y * image["width"] + x]


def grayscale(image):
    out = []
    for r, g, b in image["pixels"]:
        gray = round(0.299 * r + 0.587 * g + 0.114 * b)
        out.append([gray, gray, gray])
    return {"width": image["width"], "height": image["height"], "pixels": out}


def invert(image):
    out = [[255 - r, 255 - g, 255 - b] for r, g, b in image["pixels"]]
    return {"width": image["width"], "height": image["height"], "pixels": out}


def sepia(image):
    out = []
    for r, g, b in image["pixels"]:
        out.append([
            clamp(0.393 * r + 0.769 * g + 0.189 * b),
            clamp(0.349 * r + 0.686 * g + 0.168 * b),
            clamp(0.272 * r + 0.534 * g + 0.131 * b),
        ])
    return {"width": image["width"], "height": image["height"], "pixels": out}


def threshold(image, level=128):
    out = []
    for r, g, b in image["pixels"]:
        gray = 0.299 * r + 0.587 * g + 0.114 * b
        v = 255 if gray >= level else 0
        out.append([v, v, v])
    return {"width": image["width"], "height": image["height"], "pixels": out}


def flip_h(image):
    w, h = image["width"], image["height"]
    out = [None] * (w * h)
    for y in range(h):
        for x in range(w):
            out[y * w + (w - 1 - x)] = image["pixels"][y * w + x]
    return {"width": w, "height": h, "pixels": out}


def flip_v(image):
    w, h = image["width"], image["height"]
    out = [None] * (w * h)
    for y in range(h):
        for x in range(w):
            out[(h - 1 - y) * w + x] = image["pixels"][y * w + x]
    return {"width": w, "height": h, "pixels": out}


def rotate90(image):
    w, h = image["width"], image["height"]
    out = [None] * (w * h)
    for y in range(h):
        for x in range(w):
            new_x = h - 1 - y
            new_y = x
            out[new_y * h + new_x] = image["pixels"][y * w + x]
    return {"width": h, "height": w, "pixels": out}


def crop(image, x, y, w, h):
    width, height = image["width"], image["height"]
    x = max(0, min(x, width - 1))
    y = max(0, min(y, height - 1))
    w = max(1, min(w, width - x))
    h = max(1, min(h, height - y))
    out = []
    for row in range(h):
        for col in range(w):
            out.append(image["pixels"][(y + row) * width + (x + col)])
    return {"width": w, "height": h, "pixels": out}


KERNELS = {
    "blur": ([1, 1, 1, 1, 1, 1, 1, 1, 1], 9, 0),
    "sharpen": ([0, -1, 0, -1, 5, -1, 0, -1, 0], 1, 0),
    "emboss": ([-2, -1, 0, -1, 1, 1, 0, 1, 2], 1, 128),
}


def convolve3x3(image, matrix, divisor, offset):
    width, height = image["width"], image["height"]
    out = [None] * (width * height)
    offsets = [(-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
    for y in range(height):
        for x in range(width):
            sums = [0, 0, 0]
            for (dx, dy), k in zip(offsets, matrix):
                px = idx(image, x + dx, y + dy)
                for c in range(3):
                    sums[c] += px[c] * k
            out[y * width + x] = [clamp(sums[c] / divisor + offset) for c in range(3)]
    return {"width": width, "height": height, "pixels": out}


def sobel_edges(image):
    gray = grayscale(image)
    width, height = gray["width"], gray["height"]
    gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
    gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
    offsets = [(-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
    out = [None] * (width * height)
    for y in range(height):
        for x in range(width):
            sx = sy = 0
            for (dx, dy), kx, ky in zip(offsets, gx, gy):
                v = idx(gray, x + dx, y + dy)[0]
                sx += v * kx
                sy += v * ky
            mag = clamp((sx * sx + sy * sy) ** 0.5)
            out[y * width + x] = [mag, mag, mag]
    return {"width": width, "height": height, "pixels": out}


FILTERS = {
    "grayscale": lambda img, args: grayscale(img),
    "invert": lambda img, args: invert(img),
    "sepia": lambda img, args: sepia(img),
    "threshold": lambda img, args: threshold(img, args.level),
    "flip-h": lambda img, args: flip_h(img),
    "flip-v": lambda img, args: flip_v(img),
    "rotate90": lambda img, args: rotate90(img),
    "crop": lambda img, args: crop(img, args.x, args.y, args.w, args.h),
    "blur": lambda img, args: convolve3x3(img, *KERNELS["blur"]),
    "sharpen": lambda img, args: convolve3x3(img, *KERNELS["sharpen"]),
    "emboss": lambda img, args: convolve3x3(img, *KERNELS["emboss"]),
    "edges": lambda img, args: sobel_edges(img),
}


def main():
    parser = argparse.ArgumentParser(description="Apply a from-scratch filter to a PPM image.")
    parser.add_argument("input", nargs="?", help="Input PPM (P3) path.")
    parser.add_argument("filter", nargs="?", choices=list(FILTERS.keys()), help="Filter to apply.")
    parser.add_argument("output", nargs="?", help="Output PPM path.")
    parser.add_argument("--level", type=int, default=128, help="Threshold level (0-255).")
    parser.add_argument("--x", type=int, default=0)
    parser.add_argument("--y", type=int, default=0)
    parser.add_argument("--w", type=int, default=8)
    parser.add_argument("--h", type=int, default=8)
    parser.add_argument("--make-sample", metavar="PATH", help="Write a procedural sample PPM instead of processing one.")
    parser.add_argument("--size", type=int, default=32, help="Sample image size (with --make-sample).")
    args = parser.parse_args()

    if args.make_sample:
        write_ppm(make_sample(args.size), args.make_sample)
        print(f"Wrote {args.size}x{args.size} sample image to {args.make_sample}")
        return

    if not (args.input and args.filter and args.output):
        parser.error("Provide INPUT FILTER OUTPUT, or use --make-sample.")

    image = read_ppm(args.input)
    result = FILTERS[args.filter](image, args)
    write_ppm(result, args.output)
    print(f"Applied '{args.filter}' -> {args.output} ({result['width']}x{result['height']})")


if __name__ == "__main__":
    main()

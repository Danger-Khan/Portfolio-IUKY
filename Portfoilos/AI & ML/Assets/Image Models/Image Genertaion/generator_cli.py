#!/usr/bin/env python3
"""
generator_cli.py
-----------------------------------------------------------------------------
Command-line mirror of generator-engine.js: a tiny coordinate MLP -- a plain
feedforward network learning (x, y) -> (r, g, b) for one target image via
hand-written backprop, no numpy, no library. Trains on a small PPM image (or
a built-in procedural pattern, same one editor_cli.py's --make-sample
writes) and renders the learned function at a chosen output resolution,
optionally larger than it trained on, optionally with coordinate-jitter
noise for a "variation". Same honest scope as the browser version: one small
network fitted to one image, not a text-to-image model.

Usage:
    python3 generator_cli.py --out out.ppm
    python3 generator_cli.py --in sample.ppm --out out.ppm --width 64 --height 64
    python3 generator_cli.py --out variation.ppm --variation --noise 0.15
"""
import argparse
import math
import random


def read_ppm(path):
    with open(path, encoding="ascii") as f:
        tokens = f.read().split()
    if tokens[0] != "P3":
        raise ValueError("Only plain P3 PPM files are supported.")
    width, height = int(tokens[1]), int(tokens[2])
    values = [int(v) for v in tokens[4:4 + width * height * 3]]
    pixels = []
    for i in range(0, len(values), 3):
        pixels.append((values[i], values[i + 1], values[i + 2]))
    return {"width": width, "height": height, "pixels": pixels}


def write_ppm(width, height, pixels, path):
    with open(path, "w", encoding="ascii") as f:
        f.write(f"P3\n{width} {height}\n255\n")
        for r, g, b in pixels:
            f.write(f"{clamp(r)} {clamp(g)} {clamp(b)}\n")


def clamp(v):
    return max(0, min(255, round(v)))


def make_target_image(size):
    pixels = []
    for y in range(size):
        for x in range(size):
            base = 255 * (x + y) / (2 * size - 2) if size > 1 else 0
            checker = 40 if ((x // 4) + (y // 4)) % 2 == 0 else 0
            pixels.append((clamp(base - checker), clamp(base), clamp(255 - base + checker)))
    return {"width": size, "height": size, "pixels": pixels}


# --- tiny neural network, pure Python ---------------------------------------

def tanh(x):
    return math.tanh(x)


def dtanh_from_output(y):
    return 1 - y * y


def sigmoid(x):
    if x < -60:
        return 0.0
    if x > 60:
        return 1.0
    return 1 / (1 + math.exp(-x))


def dsigmoid_from_output(y):
    return y * (1 - y)


def create_network(sizes, rng):
    layers = []
    for l in range(len(sizes) - 1):
        in_size, out_size = sizes[l], sizes[l + 1]
        scale = math.sqrt(2 / in_size)
        weights = [[rng.gauss(0, 1) * scale for _ in range(in_size)] for _ in range(out_size)]
        biases = [0.0] * out_size
        layers.append({"weights": weights, "biases": biases, "in": in_size, "out": out_size})
    return layers


def forward_trace(layers, x):
    activations = [x]
    n = len(layers)
    for l, layer in enumerate(layers):
        prev = activations[l]
        is_last = l == n - 1
        out = []
        for o in range(layer["out"]):
            s = layer["biases"][o]
            row = layer["weights"][o]
            for i in range(layer["in"]):
                s += row[i] * prev[i]
            out.append(sigmoid(s) if is_last else tanh(s))
        activations.append(out)
    return activations


def forward(layers, x):
    return forward_trace(layers, x)[-1]


def train_step(layers, x, target, lr):
    activations = forward_trace(layers, x)
    n = len(layers)
    output = activations[n]

    deltas = [(output[i] - target[i]) * dsigmoid_from_output(output[i]) for i in range(len(output))]
    gradients = [None] * n

    for l in range(n - 1, -1, -1):
        prev_acts = activations[l]
        layer = layers[l]
        w_grad = [[deltas[o] * prev_acts[i] for i in range(layer["in"])] for o in range(layer["out"])]
        b_grad = deltas[:]
        gradients[l] = (w_grad, b_grad)

        if l > 0:
            new_deltas = [0.0] * layer["in"]
            for i in range(layer["in"]):
                s = 0.0
                for o in range(layer["out"]):
                    s += layer["weights"][o][i] * deltas[o]
                new_deltas[i] = s * dtanh_from_output(prev_acts[i])
            deltas = new_deltas

    for l in range(n):
        layer = layers[l]
        w_grad, b_grad = gradients[l]
        for o in range(layer["out"]):
            row = layer["weights"][o]
            g_row = w_grad[o]
            for i in range(layer["in"]):
                row[i] -= lr * g_row[i]
            layer["biases"][o] -= lr * b_grad[o]

    loss = sum((output[i] - target[i]) ** 2 for i in range(len(output))) / len(output)
    return loss


def image_to_samples(image):
    width, height = image["width"], image["height"]
    samples = []
    for y in range(height):
        for x in range(width):
            nx = (x / (width - 1)) * 2 - 1 if width > 1 else 0
            ny = (y / (height - 1)) * 2 - 1 if height > 1 else 0
            r, g, b = image["pixels"][y * width + x]
            samples.append(([nx, ny], [r / 255, g / 255, b / 255]))
    return samples


def train(layers, samples, epochs, lr, rng, on_epoch=None):
    order = list(range(len(samples)))
    for epoch in range(epochs):
        rng.shuffle(order)
        total = 0.0
        for i in order:
            x, target = samples[i]
            total += train_step(layers, x, target, lr)
        mean_loss = total / len(samples)
        if on_epoch:
            on_epoch(epoch, mean_loss)
    return mean_loss


def render(layers, width, height):
    pixels = []
    for y in range(height):
        for x in range(width):
            nx = (x / (width - 1)) * 2 - 1 if width > 1 else 0
            ny = (y / (height - 1)) * 2 - 1 if height > 1 else 0
            out = forward(layers, [nx, ny])
            pixels.append((clamp(out[0] * 255), clamp(out[1] * 255), clamp(out[2] * 255)))
    return pixels


def render_variation(layers, width, height, noise_std, rng):
    pixels = []
    for y in range(height):
        for x in range(width):
            nx = ((x / (width - 1)) * 2 - 1 if width > 1 else 0) + rng.gauss(0, 1) * noise_std
            ny = ((y / (height - 1)) * 2 - 1 if height > 1 else 0) + rng.gauss(0, 1) * noise_std
            out = forward(layers, [nx, ny])
            pixels.append((clamp(out[0] * 255), clamp(out[1] * 255), clamp(out[2] * 255)))
    return pixels


def main():
    parser = argparse.ArgumentParser(description="Train a tiny coordinate MLP on an image, then render its learned function.")
    parser.add_argument("--in", dest="input", metavar="PATH", help="Training image (PPM P3). Defaults to a built-in procedural pattern.")
    parser.add_argument("--train-size", type=int, default=16, help="Side length to train at when no --in image is given (default 16).")
    parser.add_argument("--out", required=True, metavar="PATH", help="Output PPM path.")
    parser.add_argument("--width", type=int, default=48, help="Output width (can exceed training resolution).")
    parser.add_argument("--height", type=int, default=48, help="Output height.")
    parser.add_argument("--hidden", type=int, default=8, help="Units per hidden layer (2 hidden layers).")
    parser.add_argument("--epochs", type=int, default=150, help="Training epochs.")
    parser.add_argument("--lr", type=float, default=0.4, help="Learning rate.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    parser.add_argument("--variation", action="store_true", help="Render a coordinate-jittered variation instead of the plain reconstruction.")
    parser.add_argument("--noise", type=float, default=0.1, help="Gaussian jitter std-dev for --variation.")
    parser.add_argument("--quiet", action="store_true", help="Suppress per-epoch loss printing.")
    args = parser.parse_args()

    rng = random.Random(args.seed)

    target = read_ppm(args.input) if args.input else make_target_image(args.train_size)
    print(f"Training on a {target['width']}x{target['height']} image ({len(target['pixels'])} pixels)...")

    samples = image_to_samples(target)
    layers = create_network([2, args.hidden, args.hidden, 3], rng)

    def on_epoch(epoch, loss):
        if not args.quiet and (epoch % max(1, args.epochs // 10) == 0 or epoch == args.epochs - 1):
            print(f"  epoch {epoch + 1:4d}/{args.epochs}  mean squared error {loss:.5f}")

    final_loss = train(layers, samples, args.epochs, args.lr, rng, on_epoch)
    print(f"Final training loss: {final_loss:.5f}")

    if args.variation:
        pixels = render_variation(layers, args.width, args.height, args.noise, rng)
        print(f"Rendered a noise-jittered variation at {args.width}x{args.height}")
    else:
        pixels = render(layers, args.width, args.height)
        print(f"Rendered the learned reconstruction at {args.width}x{args.height}")

    write_ppm(args.width, args.height, pixels, args.out)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()

/**
 * generator-engine.js
 * ---------------------------------------------------------------------------
 * A genuinely small, genuinely trained neural network -- not a stock photo
 * filter dressed up as "AI". This is a coordinate MLP (an "implicit neural
 * representation", the same family of idea behind SIREN/NeRF, scaled way
 * down): a plain feedforward network that learns the function
 * (x, y) -> (r, g, b) for one target image via ordinary backprop, written
 * from scratch with no library. Once trained it can be resampled at any
 * resolution (a real, honest side effect of learning a continuous function
 * instead of storing pixels -- that's why it can render larger than it
 * trained), or resampled with the input coordinates jittered by a little
 * Gaussian noise for a distorted "variation" of what it learned.
 *
 * Honest limits: this is one small network fitted to one image at a time,
 * trained for a few seconds in your browser -- it reproduces and gently
 * warps the picture it was shown, it does not synthesize new scenes from a
 * text prompt the way a diffusion model does.
 */

function tanh(x) { return Math.tanh(x); }
function dtanhFromOutput(y) { return 1 - y * y; }
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function dsigmoidFromOutput(y) { return y * (1 - y); }

/** Box-Muller transform -- standard normal noise from two uniform draws,
 *  used for both weight init and coordinate-jitter "variations". */
function gaussian(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function createNetwork(sizes, rng = Math.random) {
  const layers = [];
  for (let l = 0; l < sizes.length - 1; l += 1) {
    const inSize = sizes[l];
    const outSize = sizes[l + 1];
    const scale = Math.sqrt(2 / inSize);
    const weights = Array.from({ length: outSize }, () =>
      Array.from({ length: inSize }, () => gaussian(rng) * scale)
    );
    const biases = new Array(outSize).fill(0);
    layers.push({ weights, biases, inSize, outSize });
  }
  return { layers, sizes };
}

/** Returns every layer's activation, including the input, so trainStep can
 *  backprop without recomputing the forward pass. */
function forwardTrace(network, input) {
  const activations = [input];
  const nLayers = network.layers.length;
  for (let l = 0; l < nLayers; l += 1) {
    const { weights, biases } = network.layers[l];
    const prev = activations[l];
    const isLast = l === nLayers - 1;
    const out = new Array(weights.length);
    for (let o = 0; o < weights.length; o += 1) {
      let sum = biases[o];
      const row = weights[o];
      for (let i = 0; i < prev.length; i += 1) sum += row[i] * prev[i];
      out[o] = isLast ? sigmoid(sum) : tanh(sum);
    }
    activations.push(out);
  }
  return activations;
}

export function forward(network, input) {
  const activations = forwardTrace(network, input);
  return activations[activations.length - 1];
}

/** One sample of plain SGD: forward, backprop the MSE gradient by hand,
 *  update every weight and bias in place. Returns this sample's loss. */
export function trainStep(network, input, target, lr) {
  const activations = forwardTrace(network, input);
  const nLayers = network.layers.length;
  const output = activations[nLayers];

  let deltas = output.map((out, i) => (out - target[i]) * dsigmoidFromOutput(out));
  const gradients = new Array(nLayers);

  for (let l = nLayers - 1; l >= 0; l -= 1) {
    const prevActs = activations[l];
    const { weights, outSize, inSize } = network.layers[l];
    const wGrad = weights.map((row, o) => row.map((_, i) => deltas[o] * prevActs[i]));
    const bGrad = deltas.slice();
    gradients[l] = { wGrad, bGrad };

    if (l > 0) {
      const newDeltas = new Array(inSize).fill(0);
      for (let i = 0; i < inSize; i += 1) {
        let sum = 0;
        for (let o = 0; o < outSize; o += 1) sum += weights[o][i] * deltas[o];
        newDeltas[i] = sum * dtanhFromOutput(prevActs[i]);
      }
      deltas = newDeltas;
    }
  }

  for (let l = 0; l < nLayers; l += 1) {
    const { weights, biases } = network.layers[l];
    const { wGrad, bGrad } = gradients[l];
    for (let o = 0; o < weights.length; o += 1) {
      for (let i = 0; i < weights[o].length; i += 1) weights[o][i] -= lr * wGrad[o][i];
      biases[o] -= lr * bGrad[o];
    }
  }

  let loss = 0;
  for (let i = 0; i < output.length; i += 1) { const d = output[i] - target[i]; loss += d * d; }
  return loss / output.length;
}

/** Builds the (input, target) pairs a training image gives us: normalized
 *  pixel coordinates in [-1, 1] mapped to normalized RGB in [0, 1]. */
export function imageToSamples(image) {
  const { width, height, data } = image;
  const samples = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = width > 1 ? (x / (width - 1)) * 2 - 1 : 0;
      const ny = height > 1 ? (y / (height - 1)) * 2 - 1 : 0;
      const idx = (y * width + x) * 4;
      samples.push({ input: [nx, ny], target: [data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255] });
    }
  }
  return samples;
}

/** Runs one full epoch (one SGD pass over every sample) and returns the mean
 *  loss -- split out from a full train() loop so the browser can call this
 *  once per animation frame and keep the page responsive. */
export function trainEpoch(network, samples, lr) {
  let total = 0;
  for (const { input, target } of samples) total += trainStep(network, input, target, lr);
  return total / samples.length;
}

/** Renders the learned function at any resolution -- can be smaller, equal
 *  to, or larger than the resolution it trained on. */
export function renderNetwork(network, width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = width > 1 ? (x / (width - 1)) * 2 - 1 : 0;
      const ny = height > 1 ? (y / (height - 1)) * 2 - 1 : 0;
      const out = forward(network, [nx, ny]);
      const idx = (y * width + x) * 4;
      data[idx] = Math.round(out[0] * 255);
      data[idx + 1] = Math.round(out[1] * 255);
      data[idx + 2] = Math.round(out[2] * 255);
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Renders a "variation": the same learned function, sampled at coordinates
 *  jittered by Gaussian noise -- an honest, simple way to get something new
 *  out of a network that only ever learned one continuous image function. */
export function renderVariation(network, width, height, noiseStd, rng = Math.random) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (width > 1 ? (x / (width - 1)) * 2 - 1 : 0) + gaussian(rng) * noiseStd;
      const ny = (height > 1 ? (y / (height - 1)) * 2 - 1 : 0) + gaussian(rng) * noiseStd;
      const out = forward(network, [nx, ny]);
      const idx = (y * width + x) * 4;
      data[idx] = Math.round(out[0] * 255);
      data[idx + 1] = Math.round(out[1] * 255);
      data[idx + 2] = Math.round(out[2] * 255);
      data[idx + 3] = 255;
    }
  }
  return { width, height, data };
}

/** The same procedural test pattern used across the Image Models tools
 *  (Image Editor's sample image, editor_cli.py's --make-sample) -- so this
 *  tool works with zero bundled asset and every language trains on
 *  literally the same target when no image is uploaded. */
export function makeTargetImage(size) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const base = Math.round((255 * (x + y)) / (2 * size - 2));
      const checker = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0) ? 40 : 0;
      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, base - checker));
      data[idx + 1] = Math.max(0, Math.min(255, base));
      data[idx + 2] = Math.max(0, Math.min(255, 255 - base + checker));
      data[idx + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

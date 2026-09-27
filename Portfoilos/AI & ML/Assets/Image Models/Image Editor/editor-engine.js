/**
 * editor-engine.js
 * ---------------------------------------------------------------------------
 * Pixel filters and convolution kernels written from scratch -- no canvas
 * filter shorthand, no external library. Every function takes a plain
 * { width, height, data } object (data = a flat RGBA Uint8ClampedArray-like
 * array, 4 bytes per pixel, same layout as canvas ImageData) and returns a
 * new one of the same shape, so it's testable outside a browser and mirrored
 * exactly by editor_cli.py against real PPM image files.
 */

function cloneImage(image) {
  return { width: image.width, height: image.height, data: image.data.slice() };
}

/** The same procedural test pattern editor_cli.py's --make-sample writes
 *  (a diagonal gradient with a checkerboard overlay) -- lets this page work
 *  with zero bundled image asset, and lets both languages be compared on
 *  literally the same input. */
export function makeSampleImage(size) {
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

export function toGrayscale(image) {
  const out = cloneImage(image);
  for (let i = 0; i < out.data.length; i += 4) {
    const r = out.data[i], g = out.data[i + 1], b = out.data[i + 2];
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    out.data[i] = gray; out.data[i + 1] = gray; out.data[i + 2] = gray;
  }
  return out;
}

export function invert(image) {
  const out = cloneImage(image);
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 255 - out.data[i];
    out.data[i + 1] = 255 - out.data[i + 1];
    out.data[i + 2] = 255 - out.data[i + 2];
  }
  return out;
}

export function sepia(image) {
  const out = cloneImage(image);
  for (let i = 0; i < out.data.length; i += 4) {
    const r = out.data[i], g = out.data[i + 1], b = out.data[i + 2];
    out.data[i] = Math.min(255, Math.round(0.393 * r + 0.769 * g + 0.189 * b));
    out.data[i + 1] = Math.min(255, Math.round(0.349 * r + 0.686 * g + 0.168 * b));
    out.data[i + 2] = Math.min(255, Math.round(0.272 * r + 0.534 * g + 0.131 * b));
  }
  return out;
}

export function threshold(image, level = 128) {
  const out = cloneImage(image);
  for (let i = 0; i < out.data.length; i += 4) {
    const r = out.data[i], g = out.data[i + 1], b = out.data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const v = gray >= level ? 255 : 0;
    out.data[i] = v; out.data[i + 1] = v; out.data[i + 2] = v;
  }
  return out;
}

export function flipHorizontal(image) {
  const { width, height, data } = image;
  const out = { width, height, data: new data.constructor(data.length) };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = (y * width + (width - 1 - x)) * 4;
      for (let c = 0; c < 4; c += 1) out.data[dstIdx + c] = data[srcIdx + c];
    }
  }
  return out;
}

export function flipVertical(image) {
  const { width, height, data } = image;
  const out = { width, height, data: new data.constructor(data.length) };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = ((height - 1 - y) * width + x) * 4;
      for (let c = 0; c < 4; c += 1) out.data[dstIdx + c] = data[srcIdx + c];
    }
  }
  return out;
}

export function rotate90(image) {
  const { width, height, data } = image;
  const out = { width: height, height: width, data: new data.constructor(data.length) };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcIdx = (y * width + x) * 4;
      const newX = height - 1 - y;
      const newY = x;
      const dstIdx = (newY * out.width + newX) * 4;
      for (let c = 0; c < 4; c += 1) out.data[dstIdx + c] = data[srcIdx + c];
    }
  }
  return out;
}

export function crop(image, x, y, w, h) {
  const { width, height, data } = image;
  x = Math.max(0, Math.min(x, width - 1));
  y = Math.max(0, Math.min(y, height - 1));
  w = Math.max(1, Math.min(w, width - x));
  h = Math.max(1, Math.min(h, height - y));
  const out = { width: w, height: h, data: new data.constructor(w * h * 4) };
  for (let row = 0; row < h; row += 1) {
    const srcStart = ((y + row) * width + x) * 4;
    const dstStart = (row * w) * 4;
    for (let i = 0; i < w * 4; i += 1) out.data[dstStart + i] = data[srcStart + i];
  }
  return out;
}

export const KERNELS = {
  boxBlur: { matrix: [1, 1, 1, 1, 1, 1, 1, 1, 1], divisor: 9 },
  sharpen: { matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0], divisor: 1 },
  emboss: { matrix: [-2, -1, 0, -1, 1, 1, 0, 1, 2], divisor: 1, offset: 128 }
};

/** 3x3 convolution, written from scratch with edge clamping (out-of-bounds
 *  samples reuse the nearest edge pixel instead of wrapping or padding). */
export function convolve3x3(image, kernel) {
  const { width, height, data } = image;
  const { matrix, divisor, offset = 0 } = kernel;
  const out = { width, height, data: new data.constructor(data.length) };

  const at = (x, y, c) => {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    return data[(cy * width + cx) * 4 + c];
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            sum += at(x + kx, y + ky, c) * matrix[k];
            k += 1;
          }
        }
        const value = sum / divisor + offset;
        out.data[(y * width + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(value)));
      }
      out.data[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3];
    }
  }
  return out;
}

/** Sobel edge detection: two 3x3 kernels (horizontal/vertical gradient),
 *  combined as a gradient magnitude, written from scratch. */
export function sobelEdges(image) {
  const gray = toGrayscale(image);
  const { width, height, data } = gray;
  const out = { width, height, data: new data.constructor(data.length) };

  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  const at = (x, y) => {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    return data[(cy * width + cx) * 4];
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sx = 0, sy = 0, k = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const v = at(x + kx, y + ky);
          sx += v * gx[k];
          sy += v * gy[k];
          k += 1;
        }
      }
      const magnitude = Math.min(255, Math.round(Math.sqrt(sx * sx + sy * sy)));
      const idx = (y * width + x) * 4;
      out.data[idx] = magnitude; out.data[idx + 1] = magnitude; out.data[idx + 2] = magnitude;
      out.data[idx + 3] = data[idx + 3];
    }
  }
  return out;
}

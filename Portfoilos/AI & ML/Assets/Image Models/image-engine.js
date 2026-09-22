/**
 * image-engine.js
 * ---------------------------------------------------------------------------
 * Pure image-analysis functions used by the Image Processing Lab — no DOM,
 * no canvas access, just arrays in and data out, so it's usable from the
 * page itself or from the model-testing harness. Brightness/contrast/blur
 * are applied via the native canvas 2D filter API directly in index.html
 * (a browser capability, not something to reimplement here).
 */

export function colorDistSq(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

export function rgbToHex([r, g, b]) {
  const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** k-means clustering over RGB pixel samples, written from scratch —
 *  k-means++ initialisation (so starting centroids are spread out rather
 *  than randomly clumped), then the usual assign/update loop. Returns
 *  clusters sorted by how many pixels they own (dominance). */
export function kMeansColors(pixels, k, iterations = 12) {
  k = Math.max(1, Math.min(k, pixels.length));

  const centroids = [pixels[Math.floor(Math.random() * pixels.length)]];
  while (centroids.length < k) {
    const distances = pixels.map((p) => {
      let minD = Infinity;
      for (const c of centroids) {
        const d = colorDistSq(p, c);
        if (d < minD) minD = d;
      }
      return minD;
    });
    const total = distances.reduce((s, d) => s + d, 0);
    if (total <= 0) {
      centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
      continue;
    }
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < distances.length; idx += 1) {
      r -= distances[idx];
      if (r <= 0) break;
    }
    centroids.push(pixels[Math.min(idx, pixels.length - 1)]);
  }

  let assignments = new Array(pixels.length).fill(0);
  for (let iter = 0; iter < iterations; iter += 1) {
    for (let i = 0; i < pixels.length; i += 1) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c += 1) {
        const d = colorDistSq(pixels[i], centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      assignments[i] = best;
    }

    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i += 1) {
      const c = assignments[i];
      sums[c][0] += pixels[i][0];
      sums[c][1] += pixels[i][1];
      sums[c][2] += pixels[i][2];
      sums[c][3] += 1;
    }
    for (let c = 0; c < k; c += 1) {
      if (sums[c][3] > 0) {
        centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
  }

  const counts = new Array(k).fill(0);
  for (const a of assignments) counts[a] += 1;

  return centroids
    .map((c, i) => ({ color: c, count: counts[i], pct: counts[i] / pixels.length }))
    .filter((cluster) => cluster.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** Counts pixel intensity per channel (0-255) from a canvas ImageData's
 *  pixel array — the pure counting half of the histogram; drawing the
 *  result onto a canvas stays in index.html since that part is DOM-only. */
export function computeHistogram(imageData) {
  const red = new Array(256).fill(0);
  const green = new Array(256).fill(0);
  const blue = new Array(256).fill(0);

  for (let i = 0; i < imageData.length; i += 4) {
    if (imageData[i + 3] < 16) continue; // skip near-transparent pixels
    red[imageData[i]] += 1;
    green[imageData[i + 1]] += 1;
    blue[imageData[i + 2]] += 1;
  }

  return { red, green, blue };
}

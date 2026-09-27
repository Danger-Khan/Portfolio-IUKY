/**
 * extractor-engine.js
 * ---------------------------------------------------------------------------
 * A small, honest OCR demo: renders a line of text into a pixel grid using
 * the 5x7 bitmap font in Glyph Library/, optionally corrupts a few pixels,
 * then "reads" it back with a nearest-neighbor classifier (Hamming distance
 * against every known glyph -- classic, textbook machine learning, no
 * training required because the templates ARE the model).
 *
 * This is a fixed-pitch, single-font, single-line pipeline: segmentation
 * just slices the grid at the same column pitch renderText() used to lay
 * glyphs down. It is not a general-purpose OCR that reads arbitrary photos
 * -- it reads text this same tool rendered (optionally noised), which is
 * exactly what it honestly claims to do.
 */
import { GLYPH_WIDTH, GLYPH_HEIGHT, GLYPHS } from './Glyph Library/font-5x7.js';

const GAP = 1;
const CELL_WIDTH = GLYPH_WIDTH + GAP;

const GLYPH_TEMPLATES = Object.entries(GLYPHS).map(([char, rows]) => ({
  char,
  bits: rows.join('').split('').map((c) => (c === '#' ? 1 : 0))
}));

function emptyGrid(width, height) {
  return Array.from({ length: height }, () => new Array(width).fill(0));
}

/** Renders a line of text (uppercase letters, digits, spaces) into a boolean
 *  pixel grid, one glyph per fixed-width cell. Unknown characters render as
 *  blank cells (still take up a cell, so column pitch stays predictable). */
export function renderText(text) {
  const chars = text.toUpperCase().split('');
  const width = Math.max(1, chars.length * CELL_WIDTH - GAP);
  const grid = emptyGrid(width, GLYPH_HEIGHT);

  chars.forEach((ch, index) => {
    const rows = GLYPHS[ch] || GLYPHS[' '];
    const xOffset = index * CELL_WIDTH;
    for (let y = 0; y < GLYPH_HEIGHT; y += 1) {
      for (let x = 0; x < GLYPH_WIDTH; x += 1) {
        grid[y][xOffset + x] = rows[y][x] === '#' ? 1 : 0;
      }
    }
  });

  return { width, height: GLYPH_HEIGHT, grid, charCount: chars.length };
}

/** Flips each pixel with probability `rate`, returning a new grid -- lets
 *  the UI show the nearest-neighbor classifier still working under noise. */
export function addNoise(rendered, rate, rng = Math.random) {
  const grid = rendered.grid.map((row) => row.slice());
  for (let y = 0; y < rendered.height; y += 1) {
    for (let x = 0; x < rendered.width; x += 1) {
      if (rng() < rate) grid[y][x] = grid[y][x] ? 0 : 1;
    }
  }
  return { ...rendered, grid };
}

function sliceCell(rendered, cellIndex) {
  const xOffset = cellIndex * CELL_WIDTH;
  const bits = [];
  for (let y = 0; y < GLYPH_HEIGHT; y += 1) {
    for (let x = 0; x < GLYPH_WIDTH; x += 1) {
      bits.push(rendered.grid[y][xOffset + x] ? 1 : 0);
    }
  }
  return bits;
}

function hammingDistance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) d += 1;
  return d;
}

/** Classifies one glyph cell's pixels against every template, returning the
 *  closest match and its distance (0 = pixel-perfect match). */
export function classifyCell(bits) {
  let best = null;
  for (const template of GLYPH_TEMPLATES) {
    const distance = hammingDistance(bits, template.bits);
    if (!best || distance < best.distance) best = { char: template.char, distance };
  }
  return best;
}

/** Segments a rendered (optionally noised) grid back into per-cell pixels
 *  and classifies each one. Returns the recognized string plus per-char
 *  distances so the UI can show confidence. */
export function extractText(rendered) {
  const cells = [];
  for (let i = 0; i < rendered.charCount; i += 1) {
    const bits = sliceCell(rendered, i);
    cells.push({ bits, match: classifyCell(bits) });
  }
  const text = cells.map((c) => c.match.char).join('');
  return { text, cells };
}

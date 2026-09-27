/* viewer-engine.js — a self-contained STL viewer.
 *
 * Replaces the previous three.js-from-unpkg setup. Everything here is written
 * from scratch and loaded from this folder, so the viewer works with no network
 * at all: STL parsing, matrix maths, a WebGL renderer, a canvas-2D fallback for
 * machines where WebGL is unavailable, and orbit/pan/zoom controls.
 *
 * The parser and the shading maths are mirrored in stl_inspect.py, which is the
 * testable half — it renders the same view to a PPM from a terminal. The two
 * were checked against the real exports in Assets/CAD before this file was
 * written.
 *
 * Scope: STL only. STL is bare triangles — no units, colour, assembly tree or
 * tolerances — so this shows geometry and nothing more. The native SolidWorks
 * files in Assets/CAD/Source Files hold the rest.
 */

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export class STLError extends Error {}

/** Binary or ASCII?
 *
 * The leading "solid" is not a reliable signal — plenty of exporters write it
 * into a binary header. The triangle-count arithmetic is the real test: a
 * binary STL is exactly 84 + 50*count bytes.
 */
function looksBinary(buffer) {
  if (buffer.byteLength < 84) return false;
  const count = new DataView(buffer).getUint32(80, true);
  if (84 + count * 50 === buffer.byteLength) return true;
  // Trailing junk after the triangle block happens; still binary.
  if (count > 0 && 84 + count * 50 <= buffer.byteLength) return true;
  const head = new TextDecoder().decode(new Uint8Array(buffer, 0, 5)).toLowerCase();
  return head !== 'solid';
}

function faceNormal(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-20) return [0, 0, 0];
  return [nx / len, ny / len, nz / len];
}

function parseBinary(buffer) {
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  if (84 + count * 50 > buffer.byteLength) {
    throw new STLError(
      `binary STL claims ${count} triangles (${84 + count * 50} bytes) but the file is ` +
      `only ${buffer.byteLength} bytes — truncated or not an STL`
    );
  }
  const positions = new Float32Array(count * 9);
  const normals = new Float32Array(count * 9);
  let degenerate = 0;
  let offset = 84;

  for (let i = 0; i < count; i++) {
    let nx = view.getFloat32(offset, true);
    let ny = view.getFloat32(offset + 4, true);
    let nz = view.getFloat32(offset + 8, true);
    const ax = view.getFloat32(offset + 12, true);
    const ay = view.getFloat32(offset + 16, true);
    const az = view.getFloat32(offset + 20, true);
    const bx = view.getFloat32(offset + 24, true);
    const by = view.getFloat32(offset + 28, true);
    const bz = view.getFloat32(offset + 32, true);
    const cx = view.getFloat32(offset + 36, true);
    const cy = view.getFloat32(offset + 40, true);
    const cz = view.getFloat32(offset + 44, true);
    offset += 50; // 12 floats + a 2-byte attribute word

    if (nx * nx + ny * ny + nz * nz < 1e-12) {
      [nx, ny, nz] = faceNormal(ax, ay, az, bx, by, bz, cx, cy, cz);
      degenerate++;
    }

    const p = i * 9;
    positions[p] = ax; positions[p + 1] = ay; positions[p + 2] = az;
    positions[p + 3] = bx; positions[p + 4] = by; positions[p + 5] = bz;
    positions[p + 6] = cx; positions[p + 7] = cy; positions[p + 8] = cz;
    for (let v = 0; v < 3; v++) {
      normals[p + v * 3] = nx;
      normals[p + v * 3 + 1] = ny;
      normals[p + v * 3 + 2] = nz;
    }
  }

  return { positions, normals, triangleCount: count, degenerate, ascii: false };
}

function parseAscii(text) {
  const pos = [];
  const nor = [];
  let degenerate = 0;
  let normal = [0, 0, 0];
  let tri = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const low = line.toLowerCase();

    if (low.startsWith('facet normal')) {
      const parts = line.split(/\s+/);
      const n = [Number(parts[2]), Number(parts[3]), Number(parts[4])];
      normal = n.every(Number.isFinite) ? n : [0, 0, 0];
      tri = [];
    } else if (low.startsWith('vertex')) {
      const parts = line.split(/\s+/);
      const v = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
      if (!v.every(Number.isFinite)) throw new STLError(`bad vertex line: ${line}`);
      tri.push(v);
    } else if (low.startsWith('endfacet')) {
      if (tri.length !== 3) {
        throw new STLError(`facet with ${tri.length} vertices — STL needs exactly 3`);
      }
      let n = normal;
      if (n[0] * n[0] + n[1] * n[1] + n[2] * n[2] < 1e-12) {
        n = faceNormal(
          tri[0][0], tri[0][1], tri[0][2],
          tri[1][0], tri[1][1], tri[1][2],
          tri[2][0], tri[2][1], tri[2][2]
        );
        degenerate++;
      }
      for (const v of tri) pos.push(v[0], v[1], v[2]);
      for (let v = 0; v < 3; v++) nor.push(n[0], n[1], n[2]);
      tri = [];
    }
  }

  if (!pos.length) throw new STLError('no triangles found — is this really an STL?');
  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nor),
    triangleCount: pos.length / 9,
    degenerate,
    ascii: true
  };
}

export function parseSTL(buffer) {
  if (!buffer || buffer.byteLength === 0) throw new STLError('file is empty');
  if (looksBinary(buffer)) return parseBinary(buffer);
  return parseAscii(new TextDecoder().decode(buffer));
}

/* ------------------------------------------------------------------ */
/* Geometry stats                                                      */
/* ------------------------------------------------------------------ */

export function computeBounds(mesh) {
  const p = mesh.positions;
  if (!p.length) throw new STLError('empty mesh');
  const lo = [p[0], p[1], p[2]];
  const hi = [p[0], p[1], p[2]];
  for (let i = 0; i < p.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const value = p[i + a];
      if (value < lo[a]) lo[a] = value;
      if (value > hi[a]) hi[a] = value;
    }
  }
  return {
    lo, hi,
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    center: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
  };
}

/** Surface area, and signed volume via the tetrahedron/divergence sum.
 *  Volume is only meaningful for a closed surface — check watertight() first. */
export function computeMass(mesh) {
  const p = mesh.positions;
  let area = 0;
  let volume = 0;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i], ay = p[i + 1], az = p[i + 2];
    const bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
    const cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];

    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    area += Math.sqrt(nx * nx + ny * ny + nz * nz) * 0.5;

    volume += (
      ax * (by * cz - bz * cy) -
      ay * (bx * cz - bz * cx) +
      az * (bx * cy - by * cx)
    ) / 6;
  }
  return { area, volume };
}

/** Is every edge shared by exactly two facets?
 *
 * Corners are snapped to a grid first: STL stores each facet's corners
 * independently, so shared corners routinely differ in the last float bits.
 * Skipped above `limit` triangles — the map would cost more memory than the
 * answer is worth mid-browse.
 */
export function computeWatertight(mesh, limit = 200000) {
  if (mesh.triangleCount > limit) return { checked: false };
  const q = 1e6; // 1e-6 grid
  const edges = new Map();
  const p = mesh.positions;
  const key = (i) =>
    `${Math.round(p[i] * q)},${Math.round(p[i + 1] * q)},${Math.round(p[i + 2] * q)}`;

  for (let i = 0; i < p.length; i += 9) {
    const k = [key(i), key(i + 3), key(i + 6)];
    for (let e = 0; e < 3; e++) {
      const a = k[e];
      const b = k[(e + 1) % 3];
      const edge = a <= b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(edge, (edges.get(edge) || 0) + 1);
    }
  }

  let open = 0;
  for (const n of edges.values()) if (n !== 2) open++;
  return { checked: true, sealed: open === 0, openEdges: open, edgeCount: edges.size };
}

/* ------------------------------------------------------------------ */
/* 4x4 matrix maths (column-major, WebGL order)                        */
/* ------------------------------------------------------------------ */

function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

function mat4LookAt(eye, target, up) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz);
  if (len < 1e-8) {
    // Looking straight up/down the up-axis — pick any perpendicular.
    xx = 1; xy = 0; xz = 0;
  } else {
    xx /= len; xy /= len; xz /= len;
  }

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1
  ]);
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Shared look                                                         */
/* ------------------------------------------------------------------ */

const BASE_COLOR = [0.62, 0.70, 0.78];
const RIM_COLOR = [0.22, 0.74, 0.97];
const KEY_DIR = normalize([0.45, 0.72, 0.52]);
const RIM_DIR = normalize([-0.6, 0.3, -0.5]);
const SKY = [0.45, 0.62, 0.78];
const GROUND = [0.06, 0.08, 0.11];
const BG = [10, 14, 20];

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/* ------------------------------------------------------------------ */
/* WebGL renderer                                                      */
/* ------------------------------------------------------------------ */

const VERT_SRC = `
attribute vec3 aPos;
attribute vec3 aNor;
uniform mat4 uMVP;
varying vec3 vNor;
void main() {
  vNor = aNor;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const FRAG_SRC = `
precision mediump float;
varying vec3 vNor;
uniform int uMode;
uniform vec3 uFlatColor;
uniform vec3 uBase;
uniform vec3 uKeyDir;
uniform vec3 uRimDir;
uniform vec3 uRimColor;
uniform vec3 uSky;
uniform vec3 uGround;
void main() {
  if (uMode == 1) {
    gl_FragColor = vec4(uFlatColor, 1.0);
    return;
  }
  vec3 n = normalize(vNor);
  // Two-sided: STL winding is often inconsistent, and an inside-out facet
  // shading to black reads as a hole in the part.
  if (!gl_FrontFacing) n = -n;
  float hemi = 0.5 + 0.5 * n.y;
  vec3 ambient = mix(uGround, uSky, hemi) * 0.42;
  float diffuse = abs(dot(n, uKeyDir));
  float rim = max(dot(n, uRimDir), 0.0);
  vec3 col = uBase * (ambient + diffuse * 0.85) + uRimColor * rim * rim * 0.3;
  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
}`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

class WebGLBackend {
  constructor(canvas) {
    const opts = { antialias: true, alpha: false, preserveDrawingBuffer: true };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) throw new Error('no WebGL context');
    this.gl = gl;
    this.canvas = canvas;

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    gl.useProgram(program);

    this.attr = {
      pos: gl.getAttribLocation(program, 'aPos'),
      nor: gl.getAttribLocation(program, 'aNor')
    };
    this.uni = {};
    for (const name of ['uMVP', 'uMode', 'uFlatColor', 'uBase', 'uKeyDir', 'uRimDir', 'uRimColor', 'uSky', 'uGround']) {
      this.uni[name] = gl.getUniformLocation(program, name);
    }

    gl.uniform3fv(this.uni.uBase, BASE_COLOR);
    gl.uniform3fv(this.uni.uKeyDir, KEY_DIR);
    gl.uniform3fv(this.uni.uRimDir, RIM_DIR);
    gl.uniform3fv(this.uni.uRimColor, RIM_COLOR);
    gl.uniform3fv(this.uni.uSky, SKY);
    gl.uniform3fv(this.uni.uGround, GROUND);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE); // two-sided shading handles flipped facets
    gl.clearColor(BG[0] / 255, BG[1] / 255, BG[2] / 255, 1);

    this.buffers = {};
    this.counts = {};
  }

  upload(name, positions, normals) {
    const gl = this.gl;
    if (!this.buffers[name]) {
      this.buffers[name] = { pos: gl.createBuffer(), nor: gl.createBuffer() };
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[name].pos);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[name].nor);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    this.counts[name] = positions.length / 3;
  }

  drop(name) {
    const gl = this.gl;
    const b = this.buffers[name];
    if (!b) return;
    gl.deleteBuffer(b.pos);
    gl.deleteBuffer(b.nor);
    delete this.buffers[name];
    delete this.counts[name];
  }

  draw(mvp, passes) {
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uni.uMVP, false, mvp);

    for (const pass of passes) {
      const buf = this.buffers[pass.name];
      if (!buf || !this.counts[pass.name]) continue;
      gl.uniform1i(this.uni.uMode, pass.flatColor ? 1 : 0);
      if (pass.flatColor) gl.uniform3fv(this.uni.uFlatColor, pass.flatColor);

      gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);
      gl.enableVertexAttribArray(this.attr.pos);
      gl.vertexAttribPointer(this.attr.pos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, buf.nor);
      gl.enableVertexAttribArray(this.attr.nor);
      gl.vertexAttribPointer(this.attr.nor, 3, gl.FLOAT, false, 0, 0);

      gl.drawArrays(pass.lines ? gl.LINES : gl.TRIANGLES, 0, this.counts[pass.name]);
    }
  }

  dispose() {
    for (const name of Object.keys(this.buffers)) this.drop(name);
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}

/* ------------------------------------------------------------------ */
/* Canvas-2D fallback                                                  */
/* ------------------------------------------------------------------ */

/** Software rasteriser, used when WebGL is unavailable or blocked.
 *
 * Same projection and shading maths as the WebGL path and as stl_inspect.py,
 * just done per-pixel in JS. It is genuinely slow, so it renders at half
 * resolution against a triangle budget and only redraws when a drag ends —
 * the viewer says so on screen rather than pretending to be interactive.
 */
class Canvas2DBackend {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('no 2D context either');
    this.scale = 0.5;
    this.budget = 40000;
    this.mesh = null;
    this.scratch = document.createElement('canvas');
    this.scratchCtx = this.scratch.getContext('2d');
  }

  upload(name, positions, normals) {
    if (name !== 'mesh') return; // no wireframe/grid in the fallback
    this.mesh = { positions, normals };
  }

  drop(name) {
    if (name === 'mesh') this.mesh = null;
  }

  draw(mvp, passes) {
    const ctx = this.ctx;
    const W = Math.max(1, Math.floor(this.canvas.width * this.scale));
    const H = Math.max(1, Math.floor(this.canvas.height * this.scale));
    if (this.scratch.width !== W || this.scratch.height !== H) {
      this.scratch.width = W;
      this.scratch.height = H;
    }
    const image = this.scratchCtx.createImageData(W, H);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = BG[0]; data[i + 1] = BG[1]; data[i + 2] = BG[2]; data[i + 3] = 255;
    }

    if (this.mesh) {
      const depth = new Float32Array(W * H).fill(Infinity);
      const p = this.mesh.positions;
      const n = this.mesh.normals;
      const triangles = p.length / 9;
      const stride = Math.max(1, Math.ceil(triangles / this.budget));

      for (let t = 0; t < triangles; t += stride) {
        const o = t * 9;
        const screen = [];
        let skip = false;
        for (let v = 0; v < 3; v++) {
          const x = p[o + v * 3], y = p[o + v * 3 + 1], z = p[o + v * 3 + 2];
          const cx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
          const cy = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
          const cw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
          if (cw <= 1e-6) { skip = true; break; }
          screen.push([
            (cx / cw * 0.5 + 0.5) * W,
            (1 - (cy / cw * 0.5 + 0.5)) * H,
            cw
          ]);
        }
        if (skip) continue;
        const shade = shadeFlat(n[o], n[o + 1], n[o + 2]);
        fillTriangle(data, depth, W, H, screen, shade);
      }
    }

    // Rasterise into the scratch canvas, then scale that up to fill the real
    // one — drawing a canvas onto itself is not reliable across browsers.
    this.scratchCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.scratch, 0, 0, W, H, 0, 0, this.canvas.width, this.canvas.height);
  }

  dispose() { this.mesh = null; }
}

function shadeFlat(nx, ny, nz) {
  const len = Math.hypot(nx, ny, nz);
  let x = 0, y = 1, z = 0;
  if (len >= 1e-12) { x = nx / len; y = ny / len; z = nz / len; }
  const hemi = 0.5 + 0.5 * y;
  const diffuse = Math.abs(x * KEY_DIR[0] + y * KEY_DIR[1] + z * KEY_DIR[2]);
  const rimDot = Math.max(x * RIM_DIR[0] + y * RIM_DIR[1] + z * RIM_DIR[2], 0);
  const rim = rimDot * rimDot;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const ambient = (GROUND[c] + (SKY[c] - GROUND[c]) * hemi) * 0.42;
    const value = BASE_COLOR[c] * (ambient + diffuse * 0.85) + RIM_COLOR[c] * rim * 0.3;
    out[c] = Math.max(0, Math.min(255, Math.round(255 * Math.min(value, 1))));
  }
  return out;
}

function fillTriangle(data, depth, W, H, screen, shade) {
  const [[x0, y0, z0], [x1, y1, z1], [x2, y2, z2]] = screen;
  const minX = Math.max(Math.floor(Math.min(x0, x1, x2)), 0);
  const maxX = Math.min(Math.ceil(Math.max(x0, x1, x2)), W - 1);
  const minY = Math.max(Math.floor(Math.min(y0, y1, y2)), 0);
  const maxY = Math.min(Math.ceil(Math.max(y0, y1, y2)), H - 1);
  if (minX > maxX || minY > maxY) return;

  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(area) < 1e-12) return;
  const invArea = 1 / area;

  for (let py = minY; py <= maxY; py++) {
    const cy = py + 0.5;
    for (let px = minX; px <= maxX; px++) {
      const cx = px + 0.5;
      const w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) * invArea;
      const w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) * invArea;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2;
      const idx = py * W + px;
      if (z >= depth[idx]) continue;
      depth[idx] = z;
      const o = idx * 4;
      data[o] = shade[0];
      data[o + 1] = shade[1];
      data[o + 2] = shade[2];
    }
  }
}

/* ------------------------------------------------------------------ */
/* Viewer                                                              */
/* ------------------------------------------------------------------ */

export function createViewer(canvas) {
  let backend;
  let backendName;
  try {
    backend = new WebGLBackend(canvas);
    backendName = 'webgl';
  } catch (err) {
    backend = new Canvas2DBackend(canvas);
    backendName = 'canvas2d';
  }

  const state = {
    theta: Math.PI * 0.25,   // azimuth
    phi: Math.PI * 0.35,     // polar, from +Y
    radius: 200,
    target: [0, 0, 0],
    extent: 100,
    upAxis: 'y',
    wireframe: false,
    spin: false,
    mesh: null,
    prepared: null,
    dirty: true
  };

  let raf = null;
  let disposed = false;

  /* ---- camera ---- */

  function eyePosition() {
    const sinPhi = Math.sin(state.phi);
    return [
      state.target[0] + state.radius * sinPhi * Math.sin(state.theta),
      state.target[1] + state.radius * Math.cos(state.phi),
      state.target[2] + state.radius * sinPhi * Math.cos(state.theta)
    ];
  }

  function buildMVP() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const aspect = width / height || 1;
    const near = Math.max(state.extent / 500, 0.01);
    const far = Math.max(state.radius + state.extent * 4, near * 10);
    const proj = mat4Perspective(Math.PI / 4, aspect, near, far);
    const view = mat4LookAt(eyePosition(), state.target, [0, 1, 0]);
    return mat4Multiply(proj, view);
  }

  function render() {
    const passes = [{ name: 'grid', lines: true, flatColor: [0.17, 0.23, 0.30] }, { name: 'mesh' }];
    if (state.wireframe) passes.push({ name: 'wire', lines: true, flatColor: [0.08, 0.11, 0.15] });
    backend.draw(buildMVP(), passes);
  }

  function loop() {
    if (disposed) return;
    if (state.spin) {
      state.theta += 0.005;
      state.dirty = true;
    }
    if (state.dirty) {
      state.dirty = false;
      render();
    }
    raf = requestAnimationFrame(loop);
  }

  /* ---- geometry ---- */

  /** Re-centre on the origin at load time.
   *
   * Two reasons: the model matrix stays identity so normals need no transform,
   * and big CAD parts exported far from the origin keep their float precision
   * instead of shimmering. */
  function prepare(mesh) {
    const bounds = computeBounds(mesh);
    const zUp = state.upAxis === 'z';
    const src = mesh.positions;
    const srcN = mesh.normals;
    const positions = new Float32Array(src.length);
    const normals = new Float32Array(srcN.length);
    const c = bounds.center;

    for (let i = 0; i < src.length; i += 3) {
      const x = src[i] - c[0];
      const y = src[i + 1] - c[1];
      const z = src[i + 2] - c[2];
      if (zUp) {
        // Z-up source -> Y-up view
        positions[i] = x; positions[i + 1] = z; positions[i + 2] = -y;
        normals[i] = srcN[i]; normals[i + 1] = srcN[i + 2]; normals[i + 2] = -srcN[i + 1];
      } else {
        positions[i] = x; positions[i + 1] = y; positions[i + 2] = z;
        normals[i] = srcN[i]; normals[i + 1] = srcN[i + 1]; normals[i + 2] = srcN[i + 2];
      }
    }

    const size = zUp
      ? [bounds.size[0], bounds.size[2], bounds.size[1]]
      : bounds.size;
    return { positions, normals, size, bounds };
  }

  function buildGrid(extent, floorY) {
    // Round the spacing to something a person would actually read off.
    const raw = extent / 8;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    let step = magnitude;
    for (const m of [1, 2, 5, 10]) {
      if (magnitude * m >= raw) { step = magnitude * m; break; }
    }
    const half = Math.ceil((extent * 0.9) / step) * step;
    const verts = [];
    for (let v = -half; v <= half + 1e-9; v += step) {
      verts.push(-half, floorY, v, half, floorY, v);
      verts.push(v, floorY, -half, v, floorY, half);
    }
    const positions = new Float32Array(verts);
    return { positions, normals: new Float32Array(positions.length) };
  }

  function buildWireframe(positions) {
    const out = new Float32Array((positions.length / 9) * 18);
    let o = 0;
    for (let i = 0; i < positions.length; i += 9) {
      for (const [a, b] of [[0, 3], [3, 6], [6, 0]]) {
        out[o++] = positions[i + a];
        out[o++] = positions[i + a + 1];
        out[o++] = positions[i + a + 2];
        out[o++] = positions[i + b];
        out[o++] = positions[i + b + 1];
        out[o++] = positions[i + b + 2];
      }
    }
    return out;
  }

  /* ---- input ---- */

  let drag = null;

  function pointerDown(ev) {
    if (!state.mesh) return;
    canvas.setPointerCapture(ev.pointerId);
    drag = {
      id: ev.pointerId,
      x: ev.clientX,
      y: ev.clientY,
      pan: ev.button === 2 || ev.shiftKey || ev.ctrlKey
    };
    state.spin = false;
  }

  function pointerMove(ev) {
    if (!drag || drag.id !== ev.pointerId) return;
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    drag.x = ev.clientX;
    drag.y = ev.clientY;

    if (drag.pan) {
      // Move the orbit target in the camera's screen plane.
      const eye = eyePosition();
      let fx = eye[0] - state.target[0];
      let fy = eye[1] - state.target[1];
      let fz = eye[2] - state.target[2];
      const flen = Math.hypot(fx, fy, fz) || 1;
      fx /= flen; fy /= flen; fz /= flen;
      let rx = fz, ry = 0, rz = -fx;              // right = up_world x forward
      const rlen = Math.hypot(rx, ry, rz) || 1;
      rx /= rlen; ry /= rlen; rz /= rlen;
      const ux = fy * rz - fz * ry;
      const uy = fz * rx - fx * rz;
      const uz = fx * ry - fy * rx;
      const speed = state.radius / Math.max(canvas.clientHeight, 1) * 1.2;
      state.target[0] += (-dx * rx + dy * ux) * speed;
      state.target[1] += (-dx * ry + dy * uy) * speed;
      state.target[2] += (-dx * rz + dy * uz) * speed;
    } else {
      state.theta -= dx * 0.008;
      state.phi -= dy * 0.008;
      const eps = 0.01;
      state.phi = Math.max(eps, Math.min(Math.PI - eps, state.phi));
    }
    state.dirty = true;
  }

  function pointerUp(ev) {
    if (drag && drag.id === ev.pointerId) {
      drag = null;
      try { canvas.releasePointerCapture(ev.pointerId); } catch (_) { /* already gone */ }
    }
  }

  function wheel(ev) {
    if (!state.mesh) return;
    ev.preventDefault();
    const factor = Math.exp(ev.deltaY * 0.0012);
    state.radius = Math.max(state.extent * 0.15, Math.min(state.extent * 12, state.radius * factor));
    state.dirty = true;
  }

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  const onResize = () => { state.dirty = true; };
  window.addEventListener('resize', onResize);

  loop();

  /* ---- public API ---- */

  return {
    backend: backendName,

    load(mesh) {
      state.mesh = mesh;
      const prepared = prepare(mesh);
      state.prepared = prepared;
      const extent = Math.max(prepared.size[0], prepared.size[1], prepared.size[2]) || 1;
      state.extent = extent;

      backend.upload('mesh', prepared.positions, prepared.normals);
      backend.drop('wire');
      if (state.wireframe) {
        const wire = buildWireframe(prepared.positions);
        backend.upload('wire', wire, new Float32Array(wire.length));
      }

      const floorY = -prepared.size[1] / 2;
      const grid = buildGrid(extent, floorY);
      backend.upload('grid', grid.positions, grid.normals);

      this.resetView();
      return { size: prepared.size, bounds: prepared.bounds };
    },

    resetView() {
      state.theta = Math.PI * 0.25;
      state.phi = Math.PI * 0.35;
      state.radius = state.extent * 2.2;
      state.target = [0, 0, 0];
      state.dirty = true;
    },

    setView(name) {
      const views = {
        front: [0, Math.PI / 2],
        back: [Math.PI, Math.PI / 2],
        right: [Math.PI / 2, Math.PI / 2],
        left: [-Math.PI / 2, Math.PI / 2],
        top: [Math.PI * 0.25, 0.02],
        iso: [Math.PI * 0.25, Math.PI * 0.35]
      };
      const v = views[name];
      if (!v) return;
      state.theta = v[0];
      state.phi = v[1];
      state.dirty = true;
    },

    setWireframe(on) {
      state.wireframe = !!on;
      if (state.wireframe && state.prepared) {
        const wire = buildWireframe(state.prepared.positions);
        backend.upload('wire', wire, new Float32Array(wire.length));
      } else {
        backend.drop('wire');
      }
      state.dirty = true;
      return state.wireframe;
    },

    setUpAxis(axis) {
      state.upAxis = axis === 'z' ? 'z' : 'y';
      if (state.mesh) this.load(state.mesh);
      return state.upAxis;
    },

    get upAxis() { return state.upAxis; },

    setSpin(on) {
      state.spin = !!on;
      state.dirty = true;
      return state.spin;
    },

    get spinning() { return state.spin; },

    snapshot() {
      render();
      return canvas.toDataURL('image/png');
    },

    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('resize', onResize);
      backend.dispose();
    }
  };
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

/** Fetch an STL with progress.
 *
 * XHR rather than fetch() because it reports progress on a plain ArrayBuffer
 * without stream plumbing, and because its failure mode under file:// is a
 * clean error we can turn into the "pick the file yourself" path. Browsers
 * block file:// XHR for security — that is not a bug to work around, so the
 * viewer offers a file picker instead.
 */
export function loadSTLFromURL(url, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';

    xhr.onprogress = (ev) => {
      if (onProgress && ev.lengthComputable) onProgress(ev.loaded / ev.total, ev.total);
    };
    xhr.onload = () => {
      // file:// responses report status 0 but still carry the bytes.
      const ok = (xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.response);
      if (!ok) {
        reject(new STLError(`server returned ${xhr.status} for this file`));
        return;
      }
      try {
        resolve(parseSTL(xhr.response));
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new STLError('blocked'));
    // Some browsers throw synchronously on a cross-origin file:// read rather
    // than firing onerror, so both paths have to end in the same rejection.
    try {
      xhr.send();
    } catch (err) {
      reject(new STLError('blocked'));
    }
  });
}

export function loadSTLFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseSTL(reader.result));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new STLError('could not read that file'));
    reader.readAsArrayBuffer(file);
  });
}

export function formatNumber(value, digits = 2) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

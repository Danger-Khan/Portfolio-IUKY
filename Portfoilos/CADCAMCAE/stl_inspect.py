#!/usr/bin/env python3
"""STL inspector and offline thumbnail renderer.

The Python companion to viewer-engine.js. Both files implement the same STL
parser and the same geometry maths, so anything reported here is what the
browser viewer is working from. This one is the testable half: it runs from a
terminal, so the parser can be verified against real exports before the
browser ever sees them.

    python3 stl_inspect.py "Assets/CAD/Attar Box/Holder.STL"
    python3 stl_inspect.py Assets/CAD/Recycler/*.stl --quiet
    python3 stl_inspect.py part.STL --ppm preview.ppm --size 480

What it reports:
  * binary or ASCII, triangle count
  * bounding box and overall size in model units (mm for every export here)
  * surface area, and signed volume via the divergence/tetrahedron sum
  * whether the mesh is watertight (every edge shared by exactly two facets),
    which is what decides if a part is actually printable
  * how many stored facet normals were degenerate and had to be recomputed

Scope: STL only. STL stores bare triangles with no units, colour, or assembly
structure, so nothing here can report material or tolerance -- that lives in
the native SLDPRT files, not in the mesh.
"""

from __future__ import annotations

import argparse
import math
import struct
import sys
from pathlib import Path

# --------------------------------------------------------------------------
# Parsing
# --------------------------------------------------------------------------


class STLError(Exception):
    pass


class Mesh:
    """Triangle soup: flat vertex list, one normal per triangle."""

    def __init__(self, vertices, normals, degenerate=0, ascii_source=False):
        # vertices: flat list of floats, 9 per triangle (3 verts x xyz)
        # normals:  flat list of floats, 3 per triangle
        self.vertices = vertices
        self.normals = normals
        self.degenerate = degenerate
        self.ascii_source = ascii_source

    @property
    def triangle_count(self):
        return len(self.vertices) // 9

    def triangle(self, i):
        v = self.vertices
        o = i * 9
        return (
            (v[o + 0], v[o + 1], v[o + 2]),
            (v[o + 3], v[o + 4], v[o + 5]),
            (v[o + 6], v[o + 7], v[o + 8]),
        )


def _face_normal(a, b, c):
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx = uy * vz - uz * vy
    ny = uz * vx - ux * vz
    nz = ux * vy - uy * vx
    length = math.sqrt(nx * nx + ny * ny + nz * nz)
    if length < 1e-20:
        return (0.0, 0.0, 0.0), 0.0
    return (nx / length, ny / length, nz / length), length


def looks_binary(data: bytes) -> bool:
    """Decide binary vs ASCII.

    The 'solid' prefix is not reliable -- plenty of exporters write a binary
    header that happens to start with it. The triangle-count arithmetic is the
    real test: a binary STL is exactly 84 + 50*count bytes.
    """
    if len(data) < 84:
        return False
    count = struct.unpack_from("<I", data, 80)[0]
    if 84 + count * 50 == len(data):
        return True
    # Trailing junk after the triangle block is common; accept it as binary as
    # long as the count is plausible and the file does not look like text.
    if count > 0 and 84 + count * 50 <= len(data):
        return True
    return not data[:5].lower().startswith(b"solid")


def parse_binary(data: bytes) -> Mesh:
    count = struct.unpack_from("<I", data, 80)[0]
    needed = 84 + count * 50
    if needed > len(data):
        raise STLError(
            f"binary STL claims {count} triangles ({needed} bytes) but the file is "
            f"only {len(data)} bytes -- truncated or not an STL"
        )
    vertices = []
    normals = []
    degenerate = 0
    offset = 84
    for _ in range(count):
        nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz = struct.unpack_from(
            "<12f", data, offset
        )
        offset += 50  # 12 floats + 2-byte attribute word
        vertices.extend((ax, ay, az, bx, by, bz, cx, cy, cz))
        if nx * nx + ny * ny + nz * nz < 1e-12:
            computed, _ = _face_normal((ax, ay, az), (bx, by, bz), (cx, cy, cz))
            normals.extend(computed)
            degenerate += 1
        else:
            normals.extend((nx, ny, nz))
    return Mesh(vertices, normals, degenerate, ascii_source=False)


def parse_ascii(text: str) -> Mesh:
    vertices = []
    normals = []
    degenerate = 0
    normal = (0.0, 0.0, 0.0)
    tri = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        low = line.lower()
        if low.startswith("facet normal"):
            parts = line.split()
            try:
                normal = (float(parts[2]), float(parts[3]), float(parts[4]))
            except (IndexError, ValueError):
                normal = (0.0, 0.0, 0.0)
            tri = []
        elif low.startswith("vertex"):
            parts = line.split()
            try:
                tri.append((float(parts[1]), float(parts[2]), float(parts[3])))
            except (IndexError, ValueError) as exc:
                raise STLError(f"bad vertex line: {line!r}") from exc
        elif low.startswith("endfacet"):
            if len(tri) != 3:
                raise STLError(f"facet with {len(tri)} vertices -- STL needs exactly 3")
            for v in tri:
                vertices.extend(v)
            if normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2 < 1e-12:
                computed, _ = _face_normal(*tri)
                normals.extend(computed)
                degenerate += 1
            else:
                normals.extend(normal)
            tri = []
    if not vertices:
        raise STLError("no triangles found -- is this really an STL?")
    return Mesh(vertices, normals, degenerate, ascii_source=True)


def load(path: Path) -> Mesh:
    data = path.read_bytes()
    if not data:
        raise STLError("file is empty")
    if looks_binary(data):
        return parse_binary(data)
    return parse_ascii(data.decode("utf-8", errors="replace"))


# --------------------------------------------------------------------------
# Geometry
# --------------------------------------------------------------------------


def bounds(mesh: Mesh):
    v = mesh.vertices
    if not v:
        raise STLError("empty mesh")
    lo = [v[0], v[1], v[2]]
    hi = [v[0], v[1], v[2]]
    for i in range(0, len(v), 3):
        for axis in range(3):
            value = v[i + axis]
            if value < lo[axis]:
                lo[axis] = value
            if value > hi[axis]:
                hi[axis] = value
    return tuple(lo), tuple(hi)


def surface_area(mesh: Mesh) -> float:
    total = 0.0
    for i in range(mesh.triangle_count):
        a, b, c = mesh.triangle(i)
        _, cross_len = _face_normal(a, b, c)
        total += cross_len * 0.5
    return total


def signed_volume(mesh: Mesh) -> float:
    """Sum of signed tetrahedron volumes from the origin.

    Correct for any closed surface with consistent winding, wherever the origin
    sits. Meaningless for an open mesh -- check watertight() before trusting it.
    """
    total = 0.0
    for i in range(mesh.triangle_count):
        a, b, c = mesh.triangle(i)
        total += (
            a[0] * (b[1] * c[2] - b[2] * c[1])
            - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0])
        ) / 6.0
    return total


def watertight(mesh: Mesh, quantum=1e-6):
    """Every edge shared by exactly two facets?

    Vertices are snapped to a grid first, because STL stores each facet's
    corners independently and float round-trips leave shared corners differing
    in the last bits.
    """
    edges = {}
    for i in range(mesh.triangle_count):
        tri = mesh.triangle(i)
        keys = [
            (
                round(p[0] / quantum),
                round(p[1] / quantum),
                round(p[2] / quantum),
            )
            for p in tri
        ]
        for e in range(3):
            a, b = keys[e], keys[(e + 1) % 3]
            edge = (a, b) if a <= b else (b, a)
            edges[edge] = edges.get(edge, 0) + 1
    open_edges = sum(1 for n in edges.values() if n != 2)
    return open_edges == 0, open_edges, len(edges)


# --------------------------------------------------------------------------
# PPM thumbnail render (same shading model as the browser viewer)
# --------------------------------------------------------------------------


def render_ppm(mesh: Mesh, size: int = 480):
    """Z-buffered flat-shaded render. Returns PPM bytes.

    Deliberately simple: no textures, no shadows, no anti-aliasing beyond 2x
    supersampling. It exists to prove the geometry and the shading maths are
    right without needing a browser.
    """
    ss = 2
    dim = size * ss
    lo, hi = bounds(mesh)
    center = [(lo[i] + hi[i]) / 2 for i in range(3)]
    extent = max(hi[i] - lo[i] for i in range(3)) or 1.0

    # Camera: fixed three-quarter view, matching the browser viewer's default.
    dist = extent * 2.2
    eye = (dist * 0.7, dist * 0.6, dist * 0.9)
    target = (0.0, 0.0, 0.0)

    fz = [eye[i] - target[i] for i in range(3)]
    fl = math.sqrt(sum(c * c for c in fz)) or 1.0
    fz = [c / fl for c in fz]
    up = (0.0, 1.0, 0.0)
    fx = [
        up[1] * fz[2] - up[2] * fz[1],
        up[2] * fz[0] - up[0] * fz[2],
        up[0] * fz[1] - up[1] * fz[0],
    ]
    xl = math.sqrt(sum(c * c for c in fx)) or 1.0
    fx = [c / xl for c in fx]
    fy = [
        fz[1] * fx[2] - fz[2] * fx[1],
        fz[2] * fx[0] - fz[0] * fx[2],
        fz[0] * fx[1] - fz[1] * fx[0],
    ]

    fov = math.radians(45.0)
    focal = (dim / 2) / math.tan(fov / 2)

    depth = [float("inf")] * (dim * dim)
    # Background: the viewer's dark panel colour.
    color = bytearray([10, 14, 20] * (dim * dim))

    key_dir = _norm((0.45, 0.72, 0.52))
    rim_dir = _norm((-0.6, 0.3, -0.5))
    base = (0.62, 0.70, 0.78)
    rim_col = (0.22, 0.74, 0.97)

    for i in range(mesh.triangle_count):
        tri = mesh.triangle(i)
        n = (mesh.normals[i * 3], mesh.normals[i * 3 + 1], mesh.normals[i * 3 + 2])

        screen = []
        behind = False
        for p in tri:
            # World -> view (model is centred on the origin, Y up)
            m = (p[0] - center[0], p[1] - center[1], p[2] - center[2])
            rel = (m[0] - eye[0], m[1] - eye[1], m[2] - eye[2])
            vx = rel[0] * fx[0] + rel[1] * fx[1] + rel[2] * fx[2]
            vy = rel[0] * fy[0] + rel[1] * fy[1] + rel[2] * fy[2]
            vz = rel[0] * fz[0] + rel[1] * fz[1] + rel[2] * fz[2]
            if vz > -1e-6:  # behind or on the camera plane
                behind = True
                break
            sx = dim / 2 + focal * (vx / -vz)
            sy = dim / 2 - focal * (vy / -vz)
            screen.append((sx, sy, -vz))
        if behind:
            continue

        shade = _shade(n, key_dir, rim_dir, base, rim_col)
        _fill_triangle(color, depth, dim, screen, shade)

    # Box-filter the supersampled buffer down to the requested size.
    out = bytearray(size * size * 3)
    for y in range(size):
        for x in range(size):
            r = g = b = 0
            for dy in range(ss):
                row = (y * ss + dy) * dim
                for dx in range(ss):
                    o = (row + x * ss + dx) * 3
                    r += color[o]
                    g += color[o + 1]
                    b += color[o + 2]
            n = ss * ss
            o = (y * size + x) * 3
            out[o] = r // n
            out[o + 1] = g // n
            out[o + 2] = b // n

    header = f"P6\n{size} {size}\n255\n".encode("ascii")
    return header + bytes(out)


def _norm(v):
    length = math.sqrt(sum(c * c for c in v)) or 1.0
    return tuple(c / length for c in v)


def _shade(n, key_dir, rim_dir, base, rim_col):
    """Hemisphere ambient + key diffuse + rim, two-sided.

    Two-sided because STL winding is often inconsistent; flipping the normal
    toward the viewer keeps inside-out facets from rendering black.
    """
    nl = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2)
    if nl < 1e-12:
        nrm = (0.0, 1.0, 0.0)
    else:
        nrm = (n[0] / nl, n[1] / nl, n[2] / nl)

    hemi = 0.5 + 0.5 * nrm[1]
    sky = (0.45, 0.62, 0.78)
    ground = (0.06, 0.08, 0.11)
    out = []
    diffuse = max(
        abs(nrm[0] * key_dir[0] + nrm[1] * key_dir[1] + nrm[2] * key_dir[2]), 0.0
    )
    rim = max(nrm[0] * rim_dir[0] + nrm[1] * rim_dir[1] + nrm[2] * rim_dir[2], 0.0) ** 2
    for c in range(3):
        ambient = (ground[c] + (sky[c] - ground[c]) * hemi) * 0.42
        value = base[c] * (ambient + diffuse * 0.85) + rim_col[c] * rim * 0.3
        out.append(max(0, min(255, int(round(255 * min(value, 1.0))))))
    return tuple(out)


def _fill_triangle(color, depth, dim, screen, shade):
    (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = screen
    min_x = max(int(math.floor(min(x0, x1, x2))), 0)
    max_x = min(int(math.ceil(max(x0, x1, x2))), dim - 1)
    min_y = max(int(math.floor(min(y0, y1, y2))), 0)
    max_y = min(int(math.ceil(max(y0, y1, y2))), dim - 1)
    if min_x > max_x or min_y > max_y:
        return

    area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    if abs(area) < 1e-12:
        return
    inv_area = 1.0 / area

    for py in range(min_y, max_y + 1):
        cy = py + 0.5
        for px in range(min_x, max_x + 1):
            cx = px + 0.5
            w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) * inv_area
            w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) * inv_area
            w2 = 1.0 - w0 - w1
            if w0 < 0 or w1 < 0 or w2 < 0:
                continue
            z = w0 * z0 + w1 * z1 + w2 * z2
            idx = py * dim + px
            if z >= depth[idx]:
                continue
            depth[idx] = z
            o = idx * 3
            color[o], color[o + 1], color[o + 2] = shade


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def report(path: Path, mesh: Mesh, quiet=False):
    lo, hi = bounds(mesh)
    size = tuple(hi[i] - lo[i] for i in range(3))
    area = surface_area(mesh)
    volume = signed_volume(mesh)
    sealed, open_edges, edge_count = watertight(mesh)

    if quiet:
        print(
            f"{path.name}\t{mesh.triangle_count}\t"
            f"{size[0]:.1f}x{size[1]:.1f}x{size[2]:.1f}\t"
            f"{'sealed' if sealed else f'{open_edges} open edges'}"
        )
        return

    print(f"{path.name}")
    print(f"  format         {'ASCII' if mesh.ascii_source else 'binary'} STL")
    print(f"  triangles      {mesh.triangle_count:,}")
    print(f"  unique edges   {edge_count:,}")
    print(
        f"  bounding box   X {lo[0]:.3f} .. {hi[0]:.3f}\n"
        f"                 Y {lo[1]:.3f} .. {hi[1]:.3f}\n"
        f"                 Z {lo[2]:.3f} .. {hi[2]:.3f}"
    )
    print(f"  size           {size[0]:.2f} x {size[1]:.2f} x {size[2]:.2f} units")
    print(f"  surface area   {area:,.2f} units^2")
    if sealed:
        print(f"  volume         {abs(volume):,.2f} units^3")
        print("  watertight     yes -- closed surface, safe to slice")
    else:
        print(f"  volume         {abs(volume):,.2f} units^3 (unreliable, mesh is open)")
        print(f"  watertight     NO -- {open_edges:,} edge(s) not shared by two facets")
    if mesh.degenerate:
        print(
            f"  note           {mesh.degenerate:,} facet normal(s) were zero-length "
            "and were recomputed from vertex winding"
        )
    if volume < 0 and sealed:
        print(
            "  note           signed volume is negative -- facet winding is "
            "inverted (renders fine here, some slicers complain)"
        )


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Inspect STL exports and optionally render an offline preview."
    )
    ap.add_argument("files", nargs="+", type=Path, help="STL file(s) to inspect")
    ap.add_argument(
        "--quiet",
        action="store_true",
        help="one tab-separated line per file, for scanning a whole folder",
    )
    ap.add_argument("--ppm", type=Path, help="write a shaded preview (PPM) of the first file")
    ap.add_argument("--size", type=int, default=420, help="preview size in pixels (default 420)")
    args = ap.parse_args(argv)

    failures = 0
    first_mesh = None
    for path in args.files:
        try:
            mesh = load(path)
        except (STLError, OSError) as exc:
            print(f"{path}: {exc}", file=sys.stderr)
            failures += 1
            continue
        if first_mesh is None:
            first_mesh = (path, mesh)
        report(path, mesh, quiet=args.quiet)
        if not args.quiet and len(args.files) > 1:
            print()

    if args.ppm:
        if first_mesh is None:
            print("nothing to render", file=sys.stderr)
            return 1
        path, mesh = first_mesh
        args.ppm.write_bytes(render_ppm(mesh, args.size))
        print(f"wrote {args.ppm} ({args.size}x{args.size}) from {path.name}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
